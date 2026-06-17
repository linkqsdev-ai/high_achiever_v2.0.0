/**
 * Chrome Extension APIs Shim for Mobile (Ionic Capacitor Webview)
 * Implements storage, alarms, notifications, runtime, tabs, sidePanel, and audio redirection.
 */

(function() {
    console.log("Chrome Extension APIs Shim initialized");

    // --- Helper Functions ---
    function getLocalStorageItem(key) {
        let val = localStorage.getItem(key);
        if (val === null) return null;
        try {
            return JSON.parse(val);
        } catch (e) {
            return val;
        }
    }

    function setLocalStorageItem(key, val) {
        localStorage.setItem(key, JSON.stringify(val));
    }

    // --- Storage Shim ---
    const storageListeners = [];
    
    const localGet = function(keys, callback) {
        let result = {};
        let keysList = [];

        if (keys === null || keys === undefined) {
            // Retrieve all keys
            for (let i = 0; i < localStorage.length; i++) {
                let key = localStorage.key(i);
                result[key] = getLocalStorageItem(key);
            }
        } else if (typeof keys === 'string') {
            keysList = [keys];
        } else if (Array.isArray(keys)) {
            keysList = keys;
        } else if (typeof keys === 'object') {
            keysList = Object.keys(keys);
        }

        if (keysList.length > 0) {
            keysList.forEach(key => {
                let val = getLocalStorageItem(key);
                if (val !== null) {
                    result[key] = val;
                } else if (typeof keys === 'object' && keys[key] !== undefined) {
                    result[key] = keys[key]; // return default value
                }
            });
        }

        if (callback) callback(result);
        return Promise.resolve(result);
    };

    const localSet = function(items, callback) {
        let changes = {};
        Object.keys(items).forEach(key => {
            let oldValue = getLocalStorageItem(key);
            let newValue = items[key];
            setLocalStorageItem(key, newValue);
            changes[key] = { oldValue, newValue };
        });

        // Trigger onChanged listeners
        storageListeners.forEach(listener => {
            try {
                listener(changes, 'local');
            } catch (e) {
                console.error("Error in storage.onChanged listener:", e);
            }
        });

        if (callback) callback();
        return Promise.resolve();
    };

    const localRemove = function(keys, callback) {
        let keysList = typeof keys === 'string' ? [keys] : keys;
        let changes = {};
        keysList.forEach(key => {
            let oldValue = getLocalStorageItem(key);
            localStorage.removeItem(key);
            changes[key] = { oldValue, newValue: undefined };
        });

        storageListeners.forEach(listener => {
            try {
                listener(changes, 'local');
            } catch (e) {
                console.error("Error in storage.onChanged listener:", e);
            }
        });

        if (callback) callback();
        return Promise.resolve();
    };

    const localClear = function(callback) {
        localStorage.clear();
        if (callback) callback();
        return Promise.resolve();
    };

    const storageObj = {
        local: {
            get: localGet,
            set: localSet,
            remove: localRemove,
            clear: localClear
        },
        sync: {
            get: localGet,
            set: localSet,
            remove: localRemove,
            clear: localClear
        },
        onChanged: {
            addListener: function(callback) {
                if (typeof callback === 'function') {
                    storageListeners.push(callback);
                }
            },
            removeListener: function(callback) {
                let idx = storageListeners.indexOf(callback);
                if (idx !== -1) {
                    storageListeners.splice(idx, 1);
                }
            }
        }
    };

    // --- Alarms Shim ---
    const alarmsMap = {};
    const alarmListeners = [];

    const alarmsObj = {
        create: function(name, alarmInfo) {
            // Clear existing alarm with same name if any
            if (alarmsMap[name]) {
                clearTimeout(alarmsMap[name].timeoutId);
                if (alarmsMap[name].intervalId) {
                    clearInterval(alarmsMap[name].intervalId);
                }
                delete alarmsMap[name];
            }

            let periodInMinutes = alarmInfo.periodInMinutes || null;
            let delayInMinutes = alarmInfo.delayInMinutes || null;
            let when = alarmInfo.when || null;

            let delayMs = 0;
            if (when) {
                delayMs = Math.max(0, when - Date.now());
            } else if (delayInMinutes) {
                delayMs = delayInMinutes * 60 * 1000;
            } else if (periodInMinutes) {
                delayMs = periodInMinutes * 60 * 1000;
            }

            let scheduledTime = Date.now() + delayMs;

            let runAlarm = () => {
                let alarmInstance = { name: name, scheduledTime: scheduledTime };
                alarmListeners.forEach(listener => {
                    try {
                        listener(alarmInstance);
                    } catch (e) {
                        console.error("Error in alarm listener:", e);
                    }
                });

                if (periodInMinutes) {
                    scheduledTime = Date.now() + periodInMinutes * 60 * 1000;
                    if (alarmsMap[name]) {
                        alarmsMap[name].scheduledTime = scheduledTime;
                    }
                }
            };

            let timeoutId = setTimeout(() => {
                runAlarm();
                if (periodInMinutes) {
                    let intervalId = setInterval(runAlarm, periodInMinutes * 60 * 1000);
                    if (alarmsMap[name]) {
                        alarmsMap[name].intervalId = intervalId;
                    }
                }
            }, delayMs);

            alarmsMap[name] = {
                name: name,
                scheduledTime: scheduledTime,
                timeoutId: timeoutId,
                intervalId: null,
                periodInMinutes: periodInMinutes
            };
        },
        clear: function(name, callback) {
            let cleared = false;
            if (alarmsMap[name]) {
                clearTimeout(alarmsMap[name].timeoutId);
                if (alarmsMap[name].intervalId) {
                    clearInterval(alarmsMap[name].intervalId);
                }
                delete alarmsMap[name];
                cleared = true;
            }
            if (callback) callback(cleared);
            return Promise.resolve(cleared);
        },
        get: function(name, callback) {
            let alarm = alarmsMap[name];
            let res = alarm ? { name: alarm.name, scheduledTime: alarm.scheduledTime, periodInMinutes: alarm.periodInMinutes } : undefined;
            if (callback) callback(res);
            return Promise.resolve(res);
        },
        onAlarm: {
            addListener: function(callback) {
                if (typeof callback === 'function') {
                    alarmListeners.push(callback);
                }
            }
        }
    };

    // --- Notifications Shim ---
    const notificationsObj = {
        create: function(id, options, callback) {
            console.log("Notification created:", options.title, options.message);

            // 1. Show Web Notification if allowed
            if ("Notification" in window) {
                if (Notification.permission === "granted") {
                    new Notification(options.title, { body: options.message, icon: '../icon128.png' });
                } else if (Notification.permission !== "denied") {
                    Notification.requestPermission().then(permission => {
                        if (permission === "granted") {
                            new Notification(options.title, { body: options.message, icon: '../icon128.png' });
                        }
                    });
                }
            }

            // 2. Append to local notifications list so it shows up in High Achiever's custom notifications UI
            localGet(['notifications'], (res) => {
                let list = res.notifications || [];
                list.unshift({
                    id: 'n-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                    title: options.title,
                    message: options.message,
                    date: Date.now(),
                    icon: '🔔',
                    type: 'info'
                });
                localSet({ notifications: list.slice(0, 50) });
            });

            if (callback) callback(id);
        }
    };

    // --- Runtime Shim ---
    const messageListeners = [];
    const installListeners = [];

    const runtimeObj = {
        getURL: function(path) {
            let pathname = window.location.pathname;
            if (pathname.includes('/popup/') || pathname.includes('/analytics/') || pathname.includes('/break/')) {
                return '../' + path;
            }
            return path;
        },
        sendMessage: function(message, callback) {
            messageListeners.forEach(listener => {
                let responded = false;
                let responseCallback = (response) => {
                    responded = true;
                    if (callback) callback(response);
                };
                try {
                    let result = listener(message, {}, responseCallback);
                    if (result === true) {
                        // async response, wait for responseCallback
                    } else if (result !== undefined && !responded) {
                        if (callback) callback(result);
                    }
                } catch (e) {
                    console.error("Error in onMessage listener:", e);
                }
            });
            return Promise.resolve();
        },
        onMessage: {
            addListener: function(callback) {
                if (typeof callback === 'function') {
                    messageListeners.push(callback);
                }
            },
            removeListener: function(callback) {
                let idx = messageListeners.indexOf(callback);
                if (idx !== -1) {
                    messageListeners.splice(idx, 1);
                }
            }
        },
        onInstalled: {
            addListener: function(callback) {
                if (typeof callback === 'function') {
                    installListeners.push(callback);
                }
            }
        }
    };

    // Trigger onInstalled once on first launch
    setTimeout(() => {
        if (!localStorage.getItem('mobile_app_installed')) {
            installListeners.forEach(listener => {
                try {
                    listener({ reason: 'install' });
                } catch (e) {
                    console.error("Error in onInstalled listener:", e);
                }
            });
            localStorage.setItem('mobile_app_installed', 'true');
        }
    }, 100);

    // --- Tabs Shim ---
    const tabsObj = {
        create: function(options, callback) {
            if (options && options.url) {
                let url = options.url;
                if (url.includes('analytics/analytics.html')) {
                    window.location.replace('../analytics/analytics.html');
                } else if (url.includes('break/break.html')) {
                    window.location.replace('../break/break.html');
                } else {
                    window.open(url, '_blank');
                }
            }
            if (callback) callback({});
        }
    };

    // --- SidePanel Shim ---
    const sidePanelObj = {
        setPanelBehavior: function() {
            return Promise.resolve();
        }
    };

    // Assign to window.chrome
    window.chrome = {
        storage: storageObj,
        alarms: alarmsObj,
        notifications: notificationsObj,
        runtime: runtimeObj,
        tabs: tabsObj,
        sidePanel: sidePanelObj
    };

    // Shim importScripts for service worker support
    window.importScripts = function(path) {
        console.log("importScripts shimmed call:", path);
        // drive-sync.js is already imported in popup.html via script tag
    };

    // --- Audio Redirection ---
    // Listen for offscreen audio messages and play them in the main window
    window.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.target === 'offscreen') {
            let audio = window._shimAudioPlayer;
            if (!audio) {
                audio = new Audio();
                audio.id = 'shimAudioPlayer';
                window._shimAudioPlayer = audio;
                
                audio.onended = () => {
                    window.chrome.runtime.sendMessage({ type: 'audio-ended' }).catch(e => {
                        console.warn("audio-ended response failed:", e);
                    });
                };
            }

            if (message.type === 'play-audio') {
                let audioUrl = message.url;
                // If it is a relative audio url, make it relative to root www/
                if (!audioUrl.startsWith('http') && !audioUrl.startsWith('data:')) {
                    let pathname = window.location.pathname;
                    if (pathname.includes('/popup/') || pathname.includes('/analytics/') || pathname.includes('/break/')) {
                        audioUrl = '../' + audioUrl;
                    }
                }
                
                audio.src = audioUrl;
                audio.volume = message.volume !== undefined ? message.volume : 0.8;
                audio.loop = message.loop === true;
                
                audio.play()
                    .then(() => {
                        if (sendResponse) sendResponse({ status: 'playing' });
                    })
                    .catch(err => {
                        console.error("Audio playback error:", err);
                        if (sendResponse) sendResponse({ status: 'error', error: err.message });
                    });
                return true; // async response
            } else if (message.type === 'stop-audio') {
                audio.pause();
                audio.currentTime = 0;
                if (sendResponse) sendResponse({ status: 'stopped' });
                return true;
            }
        }
    });

    // --- Auto-Load background.js ---
    document.addEventListener('DOMContentLoaded', () => {
        let pathname = window.location.pathname;
        // Load background.js on popup.html and analytics.html to run timer/alarm checks
        if (!pathname.includes('break.html') && !window.isBackgroundScriptLoaded) {
            window.isBackgroundScriptLoaded = true;
            let bgScript = document.createElement('script');
            bgScript.src = '../background.js';
            bgScript.defer = true;
            document.head.appendChild(bgScript);
            console.log("Automatically injected background.js");
        }
    });
})();
