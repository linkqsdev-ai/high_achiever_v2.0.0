/**
 * Google Drive Sync Module for High Achiever
 * Handles OAuth authentication and bidirectional data sync with Google Drive's appDataFolder.
 */
const DriveSync = (() => {
    const SYNC_FILE_NAME = 'high-achiever-data.json';
    const SYNC_VERSION = 1;
    let _syncTimeout = null;
    let _cachedFileId = null;
    let _isSyncing = false;

    // ─── AUTH HELPERS ──────────────────────────────────────────────────────────

    /**
     * Get OAuth2 token via chrome.identity.
     * Returns the token string or throws on failure.
     */
    function getAuthToken(interactive = true) {
        return new Promise((resolve, reject) => {
            if (!chrome.identity || !chrome.identity.getAuthToken) {
                reject(new Error('chrome.identity API not available'));
                return;
            }
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (!token) {
                    reject(new Error('No token returned'));
                } else {
                    resolve(token);
                }
            });
        });
    }

    /**
     * Fetch user profile info from Google.
     */
    async function getUserProfile(token) {
        const resp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!resp.ok) throw new Error('Failed to fetch user profile');
        return resp.json();
    }

    /**
     * Sign the user in: get token, fetch profile, save to storage, pull from Drive.
     * Returns the profile object.
     */
    async function signIn() {
        const token = await getAuthToken(true);
        const data = await getUserProfile(token);

        const profile = {
            signedIn: true,
            email: data.email,
            name: data.name || data.email.split('@')[0],
            picture: data.picture || null
        };

        await new Promise(resolve => {
            chrome.storage.local.set({ userProfile: profile }, resolve);
        });

        // Pull any existing data from Drive
        try {
            await pullFromDrive(token);
        } catch (e) {
            console.warn('Drive pull on sign-in failed (first use or offline):', e.message);
        }

        return profile;
    }

    /**
     * Sign the user out: revoke token, clear profile, clear cached file ID.
     */
    async function signOut() {
        try {
            const token = await getAuthToken(false);
            if (token) {
                // Revoke the token
                await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
                chrome.identity.removeCachedAuthToken({ token }, () => {});
            }
        } catch (e) {
            // Token may not exist, that's fine
        }

        _cachedFileId = null;

        await new Promise(resolve => {
            chrome.storage.local.set({ userProfile: { signedIn: false } }, resolve);
        });
    }

    /**
     * Check if user is currently signed in.
     */
    function isSignedIn() {
        return new Promise(resolve => {
            chrome.storage.local.get(['userProfile'], (result) => {
                const profile = result.userProfile;
                resolve(!!(profile && profile.signedIn));
            });
        });
    }

    // ─── DRIVE FILE OPERATIONS ─────────────────────────────────────────────────

    /**
     * Find the sync file in appDataFolder.
     * Returns the file ID or null.
     */
    async function findSyncFile(token) {
        if (_cachedFileId) return _cachedFileId;

        const query = `name='${SYNC_FILE_NAME}' and trashed=false`;
        const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)`;

        const resp = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!resp.ok) throw new Error('Drive search failed: ' + resp.status);

        const result = await resp.json();
        if (result.files && result.files.length > 0) {
            _cachedFileId = result.files[0].id;
            return _cachedFileId;
        }
        return null;
    }

    /**
     * Create a new sync file in appDataFolder.
     * Returns the file ID.
     */
    async function createSyncFile(token, data) {
        const metadata = {
            name: SYNC_FILE_NAME,
            parents: ['appDataFolder'],
            mimeType: 'application/json'
        };

        const body = JSON.stringify(data);

        // Use multipart upload
        const boundary = '-------314159265358979323846';
        const delimiter = '\r\n--' + boundary + '\r\n';
        const closeDelimiter = '\r\n--' + boundary + '--';

        const multipartBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            body +
            closeDelimiter;

        const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            body: multipartBody
        });

        if (!resp.ok) throw new Error('Drive create failed: ' + resp.status);

        const result = await resp.json();
        _cachedFileId = result.id;
        return result.id;
    }

    /**
     * Update the sync file content.
     */
    async function updateSyncFile(token, fileId, data) {
        const body = JSON.stringify(data);

        const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: body
        });

        if (!resp.ok) throw new Error('Drive update failed: ' + resp.status);
        return resp.json();
    }

    /**
     * Read the sync file content from Drive.
     */
    async function readSyncFile(token, fileId) {
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!resp.ok) throw new Error('Drive read failed: ' + resp.status);
        return resp.json();
    }

    // ─── SYNC OPERATIONS ───────────────────────────────────────────────────────

    /**
     * Gather all syncable data from chrome.storage.
     */
    function gatherLocalData() {
        return new Promise(resolve => {
            chrome.storage.local.get([
                'taskBuckets', 'tasks', 'prayers',
                'focusHistory', 'focusHistorySessions',
                'hydrationHistory', 'eyeGuardHistory',
                'reminders', 'credentials', 'masterPasswordHash'
            ], (result) => {
                resolve({
                    version: SYNC_VERSION,
                    lastSynced: new Date().toISOString(),
                    taskBuckets: result.taskBuckets || [],
                    tasks: result.tasks || [],
                    prayers: result.prayers || [],
                    focusHistory: result.focusHistory || {},
                    focusHistorySessions: result.focusHistorySessions || [],
                    hydrationHistory: result.hydrationHistory || {},
                    eyeGuardHistory: result.eyeGuardHistory || [],
                    reminders: result.reminders || [],
                    credentials: result.credentials || [],
                    masterPasswordHash: result.masterPasswordHash || null
                });
            });
        });
    }

    /**
     * Apply data pulled from Drive into local chrome.storage.
     */
    function applyDriveData(data) {
        return new Promise(resolve => {
            const toSet = {};
            if (data.taskBuckets) toSet.taskBuckets = data.taskBuckets;
            if (data.tasks) toSet.tasks = data.tasks;
            if (data.prayers) toSet.prayers = data.prayers;
            if (data.focusHistory) toSet.focusHistory = data.focusHistory;
            if (data.focusHistorySessions) toSet.focusHistorySessions = data.focusHistorySessions;
            if (data.hydrationHistory) toSet.hydrationHistory = data.hydrationHistory;
            if (data.eyeGuardHistory) toSet.eyeGuardHistory = data.eyeGuardHistory;
            if (data.reminders) toSet.reminders = data.reminders;
            if (data.credentials) toSet.credentials = data.credentials;
            if (data.masterPasswordHash) toSet.masterPasswordHash = data.masterPasswordHash;

            chrome.storage.local.set(toSet, resolve);
        });
    }

    /**
     * Push local data to Google Drive (debounced).
     * Call this after every storage change.
     */
    function syncToDrive() {
        if (_syncTimeout) clearTimeout(_syncTimeout);

        _syncTimeout = setTimeout(async () => {
            if (_isSyncing) return;
            _isSyncing = true;
            updateSyncBadge('syncing');

            try {
                const token = await getAuthToken(false);
                const data = await gatherLocalData();
                const fileId = await findSyncFile(token);

                if (fileId) {
                    await updateSyncFile(token, fileId, data);
                } else {
                    await createSyncFile(token, data);
                }

                updateSyncBadge('synced');
            } catch (e) {
                console.warn('Drive sync failed:', e.message);
                updateSyncBadge('error');
            } finally {
                _isSyncing = false;
            }
        }, 3000); // 3-second debounce
    }

    /**
     * Pull data from Google Drive and apply locally.
     */
    async function pullFromDrive(token) {
        if (!token) token = await getAuthToken(false);

        _isSyncing = true;
        updateSyncBadge('syncing');

        try {
            const fileId = await findSyncFile(token);
            if (!fileId) {
                // No existing data on Drive — push current local data up
                const data = await gatherLocalData();
                await createSyncFile(token, data);
                updateSyncBadge('synced');
                return;
            }

            const driveData = await readSyncFile(token, fileId);
            if (driveData && driveData.version) {
                await applyDriveData(driveData);
            }

            updateSyncBadge('synced');
        } catch (e) {
            console.warn('Drive pull failed:', e.message);
            updateSyncBadge('error');
            throw e;
        } finally {
            // Delay releasing the lock to let storage.sync.set callbacks/onChanged finish
            setTimeout(() => {
                _isSyncing = false;
            }, 1000);
        }
    }

    // ─── UI HELPERS ────────────────────────────────────────────────────────────

    /**
     * Update the sync status badge in the UI.
     * @param {'synced'|'syncing'|'error'|'offline'} status
     */
    function updateSyncBadge(status) {
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ syncStatus: status });
        }

        if (typeof document === 'undefined') return;

        const badge = document.getElementById('syncStatusBadge');
        if (!badge) return;

        badge.classList.remove('synced', 'syncing', 'error', 'offline');
        badge.classList.add(status);

        switch (status) {
            case 'synced':
                badge.textContent = '✓ Synced';
                break;
            case 'syncing':
                badge.textContent = '⟳ Syncing...';
                break;
            case 'error':
                badge.textContent = '✗ Sync failed';
                // Auto-clear error after 5 seconds
                setTimeout(() => {
                    if (badge.classList.contains('error')) {
                        badge.textContent = '';
                        badge.classList.remove('error');
                    }
                }, 5000);
                break;
            case 'offline':
                badge.textContent = '○ Offline';
                break;
        }
    }

    // ─── PUBLIC API ────────────────────────────────────────────────────────────

    return {
        signIn,
        signOut,
        isSignedIn,
        getAuthToken,
        getUserProfile,
        syncToDrive,
        pullFromDrive,
        updateSyncBadge
    };
})();
