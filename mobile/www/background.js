/**
 * Core Service Worker for High Achiever App
 */

importScripts('popup/drive-sync.js');

// Allow users to open the side panel by clicking on the action toolbar icon
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
}
// Initialize default state on install
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            pomodoroState: { status: 'idle', timeLeft: 1500 },
            hydrationState: { todayIntake: 0, goal: 8 },
            hydrationInterval: 30,
            eyeGuardState: { nextBreak: Date.now() + 20 * 60 * 1000, interval: 20 }
        });
        
        // Initialize default prayers in sync storage
        chrome.storage.local.get(['prayers'], (result) => {
            if (!result.prayers || result.prayers.length === 0) {
                chrome.storage.local.set({
                    prayers: [
                        { id: 'p-fajr', name: 'Fajr', time: '05:00', enabled: true },
                        { id: 'p-zlugar', name: 'Zlugar', time: '12:30', enabled: true },
                        { id: 'p-asar', name: 'Asar', time: '15:45', enabled: true },
                        { id: 'p-magrib', name: 'Magrib', time: '18:30', enabled: true },
                        { id: 'p-isha', name: 'Isha', time: '20:00', enabled: true }
                    ]
                });
            }
        });
        
        setupInitialAlarms();
    }
});

function setupInitialAlarms() {
    // EyeGuard - 20 minutes default
    chrome.alarms.create('eyeGuardAlarm', { periodInMinutes: 20 });
    // Hydration - 30 minutes default
    chrome.alarms.create('hydrationAlarm', { periodInMinutes: 30 });
    // Prayer Checker - check every minute
    chrome.alarms.create('prayerCheckerAlarm', { periodInMinutes: 1 });
}

// Alarm Listener
chrome.alarms.onAlarm.addListener((alarm) => {
    switch (alarm.name) {
        case 'eyeGuardAlarm':
            triggerEyeGuardBreak();
            break;
        case 'hydrationAlarm':
            triggerHydrationReminder();
            break;
        case 'pomodoroEnd':
            handlePomodoroEnd();
            break;
        case 'prayerCheckerAlarm':
            checkPrayersAndNotify();
            break;
        default:
            break;
    }
});

function triggerEyeGuardBreak() {
    chrome.tabs.create({
        url: chrome.runtime.getURL("break/break.html"),
        active: true
    }).catch(err => {
        // Fallback to creating a new window if no active window exists
        chrome.windows.create({
            url: chrome.runtime.getURL("break/break.html"),
            type: 'normal'
        }).catch(e => console.error(e));
    });

    chrome.storage.local.get(['eyeGuardState'], (result) => {
        let state = result.eyeGuardState || {};
        const interval = state.interval || 20;
        state.nextBreak = Date.now() + interval * 60 * 1000;
        chrome.storage.local.set({ eyeGuardState: state });
    });
}

function triggerHydrationReminder() {
    createNativeNotification('hydration', 'Time to Hydrate! 💧', 'Grab a glass of water to stay focused and healthy.');
    playBeepSound();
}

// Per-task timer completed handler
function handlePomodoroEnd() {
    chrome.storage.local.get(['pomodoroState'], (result) => {
        let state = result.pomodoroState;
        
        if (state && state.status === 'running') {
            let title = 'Task Focus Complete! 🎯';
            let message = 'Your focus session has ended.';
            let minutesCompleted = 25; // default

            if (state.activeTaskId) {
                message = `"${state.activeTaskName}" focus session is complete!`;
                minutesCompleted = Math.round(state.timeLeft / 60) || 25;
            }

            // Update task completion in storage
            chrome.storage.local.get(['tasks', 'focusHistory', 'focusHistorySessions'], (syncResult) => {
                let tasks = syncResult.tasks || [];
                let history = syncResult.focusHistory || {};
                let sessions = syncResult.focusHistorySessions || [];
                const d = new Date();
                const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                if (state.activeTaskId) {
                    tasks = tasks.map(t => {
                        if (t.id === state.activeTaskId) {
                            return { ...t, completed: true, timeLeft: t.time * 60 };
                        }
                        return t;
                    });
                }

                // Log to history
                let currentEntry = history[today] || { count: 0, minutes: 0 };
                if (typeof currentEntry === 'number') {
                    currentEntry = { count: currentEntry, minutes: currentEntry * 25 };
                }
                currentEntry.count += 1;
                currentEntry.minutes += minutesCompleted;
                history[today] = currentEntry;

                // Log detailed session log
                sessions.push({
                    id: 'fs-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                    date: today,
                    timestamp: Date.now(),
                    bucketId: state.activeBucketId || 'unassigned',
                    bucketName: state.activeBucketName || 'Unassigned',
                    taskName: state.activeTaskName || 'Quick Focus',
                    minutes: minutesCompleted
                });

                chrome.storage.local.set({
                    tasks: tasks,
                    focusHistory: history,
                    focusHistorySessions: sessions
                }, () => {
                    // Reset pomodoroState to idle
                    state.status = 'idle';
                    state.timeLeft = 1500;
                    delete state.activeTaskId;
                    delete state.activeTaskName;
                    delete state.activeBucketId;
                    delete state.activeBucketName;
                    
                    chrome.storage.local.set({ pomodoroState: state }, () => {
                        createNativeNotification('pomodoro', title, message);
                    });
                });
            });
        }
    });
}

// Prayer alarm checking logic (Alerts 7 minutes before prayer)
function checkPrayersAndNotify() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    chrome.storage.local.get(['prayers', 'lastNotifiedPrayers'], (result) => {
        const prayers = result.prayers || [];
        let lastNotified = result.lastNotifiedPrayers || {};
        
        // Reset notifications log if date has changed
        if (lastNotified.date !== todayStr) {
            lastNotified = { date: todayStr, list: [] };
        }
        
        let updatedList = [...lastNotified.list];
        let shouldUpdateStorage = false;

        prayers.forEach(prayer => {
            if (!prayer.enabled) return;
            if (updatedList.includes(prayer.id)) return; // already notified today
            
            const [hours, minutes] = prayer.time.split(':').map(Number);
            const prayerTimeToday = new Date();
            prayerTimeToday.setHours(hours, minutes, 0, 0);

            // Alert trigger is exactly 7 minutes before
            const alertTimeToday = new Date(prayerTimeToday.getTime() - 7 * 60 * 1000);
            
            // Trigger alert if we are past alert time, but not past prayer time by more than 5 minutes
            if (now >= alertTimeToday && now < new Date(prayerTimeToday.getTime() + 5 * 60 * 1000)) {
                createNativeNotification(
                    'prayer_' + prayer.id, 
                    `${prayer.name} is in 7 minutes! 🕌`, 
                    `Be ready for ${prayer.name} prayer scheduled at ${formatPrayerTime12h(prayer.time)}.`
                );
                playAdhanSound();
                updatedList.push(prayer.id);
                shouldUpdateStorage = true;
            }
        });

        if (shouldUpdateStorage) {
            lastNotified.list = updatedList;
            chrome.storage.local.set({ lastNotifiedPrayers: lastNotified });
        }
    });
}

function formatPrayerTime12h(timeStr) {
    let [hours, minutes] = timeStr.split(':');
    let suffix = parseInt(hours) >= 12 ? 'PM' : 'AM';
    let displayHours = parseInt(hours) % 12 || 12;
    return `${displayHours}:${minutes} ${suffix}`;
}

function createNativeNotification(id, title, message) {
    chrome.notifications.create(id + '_' + Date.now(), {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon128.png'),
        title: title,
        message: message,
        priority: 2,
        requireInteraction: true
    });
}

async function playAdhanSound() {
    try {
        if (!(await hasOffscreenDocument())) {
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Play beautiful Adhan audio call to prayer'
            });
        }
    } catch (e) {
        console.error("Offscreen document creation error:", e);
    }
    
    chrome.storage.local.set({ isAdhanPlaying: true });
    
    chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'play-audio',
        url: 'Adhan.mp3',
        volume: 0.8
    }).catch(e => console.error("Message send error:", e));
}

async function stopAdhanSound() {
    chrome.storage.local.set({ isAdhanPlaying: false });
    if (await hasOffscreenDocument()) {
        chrome.runtime.sendMessage({
            target: 'offscreen',
            type: 'stop-audio'
        }).catch(e => console.error("Message send error:", e));
    }
}

let beepTimeoutId = null;

async function playBeepSound() {
    try {
        if (!(await hasOffscreenDocument())) {
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Play alarm beep for hydration'
            });
        }
    } catch (e) {
        console.error("Offscreen document creation error:", e);
    }
    
    chrome.storage.local.set({ isAlarmPlaying: true });
    chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'play-audio',
        url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
        volume: 0.8,
        loop: true
    }).catch(e => console.error("Message send error for beep sound:", e));

    if (beepTimeoutId) clearTimeout(beepTimeoutId);
    beepTimeoutId = setTimeout(() => {
        stopBeepSound();
    }, 15000);
}

function stopBeepSound() {
    if (beepTimeoutId) {
        clearTimeout(beepTimeoutId);
        beepTimeoutId = null;
    }
    chrome.storage.local.set({ isAlarmPlaying: false });
    chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'stop-audio'
    }).catch(e => console.error("Message send error:", e));
}
async function hasOffscreenDocument() {
    if (chrome.runtime.getContexts) {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });
        return contexts.length > 0;
    }
    return false;
}

// Check storage changes for prayers notification and auto-syncing to Google Drive
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.prayers) {
        checkPrayersAndNotify();
    }

    // Auto-sync syncable changes to Google Drive
    const syncableKeys = ['taskBuckets', 'tasks', 'prayers', 'focusHistory', 'focusHistorySessions', 'hydrationHistory', 'eyeGuardHistory', 'reminders', 'credentials', 'masterPasswordHash'];
    const hasSyncableChanges = syncableKeys.some(key => changes[key] !== undefined);
    if (hasSyncableChanges) {
        DriveSync.isSignedIn().then(signedIn => {
            if (signedIn) {
                DriveSync.syncToDrive();
            }
        });
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'testAdhan') {
        playAdhanSound();
        sendResponse({ success: true });
    } else if (message.action === 'stopAdhan') {
        stopAdhanSound();
        sendResponse({ success: true });
    } else if (message.action === 'stopAlarm') {
        stopBeepSound();
        sendResponse({ success: true });
    } else if (message.type === 'audio-ended') {
        chrome.storage.local.set({ isAdhanPlaying: false, isAlarmPlaying: false });
    }
});
