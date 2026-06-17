document.addEventListener('DOMContentLoaded', () => {
    let localBuckets = [];
    let localTasks = [];
    let draggedBucketId = null;
    let draggedTaskId = null;
    let editingBucketId = null;
    let localPomodoroState = { status: 'idle', timeLeft: 1500 };

    // Initialize Flatpickr for premium date picker design
    if (typeof flatpickr !== 'undefined') {
        flatpickr("input[type='date']", {
            altInput: true,
            altFormat: "d-M-Y",
            dateFormat: "Y-m-d",
            disableMobile: true,
            animate: true,
            altInputClass: "premium-date-input",
            position: "auto right",
            onChange: function(selectedDates, dateStr, instance) {
                instance.element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    // Custom confirmation modal helper
    function showCustomConfirm(title, message, onConfirm) {
        const modal = document.getElementById('customConfirmModal');
        const titleEl = document.getElementById('modalTitle');
        const messageEl = document.getElementById('modalMessage');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.add('active');

        // Clean up previous listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newConfirmBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            onConfirm();
        });

        newCancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Custom alert modal helper
    function showCustomAlert(title, message) {
        // Replaced modal dialog with non-blocking inline banner / notification
        const id = `alert-${Date.now()}`;
        addNotification(id, title, message, 'info', 'ℹ️');
    }

    // --- Notification System ---
    let appNotifications = [];
    
    function loadNotifications() {
        chrome.storage.local.get(['notifications'], (res) => {
            appNotifications = res.notifications || [];
            renderNotificationCenter();
        });
    }
    
    function addNotification(id, title, message, type = 'info', icon = '🔔') {
        chrome.storage.local.get(['notifications'], (res) => {
            let notifs = res.notifications || [];
            if (!notifs.some(n => n.id === id)) {
                notifs.unshift({ id, title, message, type, icon, date: new Date().toISOString(), read: false, dismissedBanner: false });
                chrome.storage.local.set({ notifications: notifs }, () => {
                    appNotifications = notifs;
                    renderNotificationCenter();
                    showInlineBanner(id, title, message, icon, type);
                });
            } else {
                const n = notifs.find(n => n.id === id);
                if (!n.dismissedBanner) {
                    showInlineBanner(id, title, message, icon, type);
                }
            }
        });
    }
    
    function showInlineBanner(id, title, message, icon, type) {
        const container = document.getElementById('popupNotificationContainer');
        if (!container) return;
        if (document.getElementById(`banner-${id}`)) return;
        
        let bgColor = '#e0f2fe', borderColor = '#bae6fd', textColor = '#0369a1';
        if (type === 'warning') { bgColor = '#fff7ed'; borderColor = '#fdba74'; textColor = '#c2410c'; }
        
        const banner = document.createElement('div');
        banner.id = `banner-${id}`;
        banner.className = 'popup-notification';
        banner.style = `background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 6px;`;
        banner.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; color: ${textColor}; font-weight: 500;">
                <span style="font-size: 1rem;">${icon}</span>
                <span><strong>${title}</strong>: ${message}</span>
            </div>
            <button class="close-banner-btn" style="background: none; border: none; color: ${textColor}; font-size: 0.85rem; font-weight: 700; cursor: pointer; padding: 2px 6px;">✕</button>
        `;
        
        banner.querySelector('.close-banner-btn').addEventListener('click', () => {
            banner.remove();
            if (container.children.length === 0) container.style.display = 'none';
            const notifIndex = appNotifications.findIndex(n => n.id === id);
            if (notifIndex !== -1) {
                appNotifications[notifIndex].dismissedBanner = true;
                chrome.storage.local.set({ notifications: appNotifications });
            }
        });
        
        container.appendChild(banner);
        container.style.display = 'flex';
    }
    
    function removeNotification(id) {
        appNotifications = appNotifications.filter(n => n.id !== id);
        chrome.storage.local.set({ notifications: appNotifications }, () => {
            renderNotificationCenter();
            const banner = document.getElementById(`banner-${id}`);
            if (banner) {
                banner.remove();
                const container = document.getElementById('popupNotificationContainer');
                if (container && container.children.length === 0) container.style.display = 'none';
            }
        });
    }
    
    function renderNotificationCenter() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = appNotifications.length;
            badge.style.display = appNotifications.length > 0 ? 'flex' : 'none';
        }
        
        const list = document.getElementById('notificationList');
        if (!list) return;
        
        list.innerHTML = '';
        if (appNotifications.length === 0) {
            list.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.85rem; padding-top: 20px;">No notifications.</div>';
            return;
        }
        
        appNotifications.forEach(n => {
            const item = document.createElement('div');
            item.style = 'background: #ffffff; border-radius: 20px; padding: 16px 20px; display: flex; gap: 16px; align-items: center; position: relative; box-shadow: 0 4px 15px rgba(0,0,0,0.04); margin-bottom: 12px;';
            item.innerHTML = `
                <div style="width: 48px; height: 48px; background: #fdf5f3; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">${n.icon}</div>
                <div style="flex: 1; padding-right: 20px;">
                    <strong style="color: #334155; font-size: 0.95rem; font-weight: 700; display: block; margin-bottom: 4px;">${n.title}</strong>
                    <div style="font-size: 0.8rem; color: #64748b; line-height: 1.3;">${n.message} <span style="font-size: 0.7rem; color: #cbd5e1; margin-left: 6px;">${new Date(n.date).toLocaleDateString([], {month:'short', day:'numeric'})}</span></div>
                </div>
                <button class="delete-notif-btn" title="Dismiss" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: flex; align-items: center; transition: color 0.2s;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </button>
            `;
            const deleteBtn = item.querySelector('.delete-notif-btn');
            deleteBtn.addEventListener('click', () => removeNotification(n.id));
            deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.color = '#1e293b');
            deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.color = '#94a3b8');
            list.appendChild(item);
        });
    }

    document.getElementById('notificationBellBtn')?.addEventListener('click', () => {
        document.getElementById('notificationCenterModal').classList.add('active');
    });
    
    document.getElementById('closeNotificationCenterBtn')?.addEventListener('click', () => {
        document.getElementById('notificationCenterModal').classList.remove('active');
    });

    document.getElementById('clearAllNotificationsBtn')?.addEventListener('click', () => {
        chrome.storage.local.set({ notifications: [] }, () => {
            appNotifications = [];
            renderNotificationCenter();
            const container = document.getElementById('popupNotificationContainer');
            if (container) {
                container.innerHTML = '';
                container.style.display = 'none';
            }
        });
    });

    loadNotifications();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.isAlarmPlaying) {
            const banner = document.getElementById('activeAlarmBanner');
            if (banner) {
                banner.style.display = changes.isAlarmPlaying.newValue ? 'flex' : 'none';
            }
        }
    });

    document.getElementById('stopAlarmBtn')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'stopAlarm' });
    });
    // --- End Notification System ---

    function checkAndRolloverBuckets(callback) {
        const dNow = new Date();
        const todayStr = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}-${String(dNow.getDate()).padStart(2, '0')}`;

        chrome.storage.local.get(['lastOpenedDate', 'taskBuckets', 'tasks'], (res) => {
            const lastOpenedDate = res.lastOpenedDate;
            let buckets = res.taskBuckets || [];
            let tasks = res.tasks || [];
            let updated = false;

            if (lastOpenedDate && lastOpenedDate !== todayStr) {
                const yesterdayBuckets = buckets.filter(b => b.date === lastOpenedDate);
                const alwaysBuckets = buckets.filter(b => !b.date);

                const newBucketsToCreate = [];
                const newTasksToCreate = [];

                // 1. Rollover date-specific buckets (with deduplication check)
                yesterdayBuckets.forEach(b => {
                    // Skip if a bucket with the same name already exists for today
                    const alreadyRolledOver = buckets.some(existing =>
                        existing.date === todayStr &&
                        existing.name.toLowerCase() === b.name.toLowerCase()
                    );
                    if (alreadyRolledOver) return;

                    const newBucketId = 'b-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                    newBucketsToCreate.push({
                        id: newBucketId,
                        name: b.name,
                        colorCode: b.colorCode,
                        date: todayStr,
                        collapsed: b.collapsed || false
                    });

                    const isGreen = b.colorCode === '#10b981';
                    const yesterdayTasks = tasks.filter(t => t.bucketId === b.id && t.date === lastOpenedDate);

                    if (isGreen) {
                        // Green bucket: copy ALL tasks but clear every checkbox (fresh slate)
                        yesterdayTasks.forEach(t => {
                            const newTaskId = 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                            newTasksToCreate.push({
                                id: newTaskId,
                                bucketId: newBucketId,
                                name: t.name,
                                time: t.time,
                                priority: t.priority !== undefined ? t.priority : 4,
                                date: todayStr,
                                completed: false,
                                timeLeft: t.time * 60
                            });
                        });
                    } else {
                        // Non-green bucket: copy ONLY unchecked tasks (drop completed ones)
                        yesterdayTasks.filter(t => !t.completed).forEach(t => {
                            const newTaskId = 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                            newTasksToCreate.push({
                                id: newTaskId,
                                bucketId: newBucketId,
                                name: t.name,
                                time: t.time,
                                priority: t.priority !== undefined ? t.priority : 4,
                                date: todayStr,
                                completed: false,
                                timeLeft: t.time * 60
                            });
                        });
                    }
                });

                // 2. Rollover tasks for "Always" buckets
                alwaysBuckets.forEach(b => {
                    const isGreen = b.colorCode === '#10b981';
                    const yesterdayTasks = tasks.filter(t => t.bucketId === b.id && t.date === lastOpenedDate);

                    if (isGreen) {
                        // Green always-bucket: copy ALL tasks but clear every checkbox
                        yesterdayTasks.forEach(t => {
                            const alreadyExists = tasks.some(existing => existing.bucketId === b.id && existing.date === todayStr && existing.name === t.name);
                            if (!alreadyExists) {
                                const newTaskId = 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                                newTasksToCreate.push({
                                    id: newTaskId,
                                    bucketId: b.id,
                                    name: t.name,
                                    time: t.time,
                                    priority: t.priority !== undefined ? t.priority : 4,
                                    date: todayStr,
                                    completed: false,
                                    timeLeft: t.time * 60
                                });
                            }
                        });
                    } else {
                        // Non-green always-bucket: copy ONLY unchecked tasks (drop completed ones)
                        yesterdayTasks.filter(t => !t.completed).forEach(t => {
                            const alreadyExists = tasks.some(existing => existing.bucketId === b.id && existing.date === todayStr && existing.name === t.name);
                            if (!alreadyExists) {
                                const newTaskId = 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                                newTasksToCreate.push({
                                    id: newTaskId,
                                    bucketId: b.id,
                                    name: t.name,
                                    time: t.time,
                                    priority: t.priority !== undefined ? t.priority : 4,
                                    date: todayStr,
                                    completed: false,
                                    timeLeft: t.time * 60
                                });
                            }
                        });
                    }
                });

                if (newBucketsToCreate.length > 0 || newTasksToCreate.length > 0) {
                    buckets = [...buckets, ...newBucketsToCreate];
                    tasks = [...tasks, ...newTasksToCreate];
                    updated = true;
                }
            }

            // Always update lastOpenedDate to today
            chrome.storage.local.set({ lastOpenedDate: todayStr });

            if (updated) {
                chrome.storage.local.set({ taskBuckets: buckets, tasks: tasks }, () => {
                    localBuckets = buckets;
                    localTasks = tasks;
                    callback();
                });
            } else {
                localBuckets = buckets;
                localTasks = tasks;
                callback();
            }
        });
    }

    // Initialize task and bucket local cache with day-to-day rollover check
    checkAndRolloverBuckets(() => {
        chrome.storage.local.get(['pomodoroState'], (stateResult) => {
            localPomodoroState = stateResult.pomodoroState || { status: 'idle', timeLeft: 1500 };
            renderTasksAndBuckets();
        });
    });

    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active classes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked
            btn.classList.add('active');
            const target = btn.getAttribute('data-target');
            document.getElementById(target).classList.add('active');

            if (target === 'pomodoro') {
                renderTasksAndBuckets();
            } else if (target === 'prayer') {
                renderPrayers();
            } else if (target === 'reminders') {
                if (typeof renderReminders === 'function') renderReminders();
            } else if (target === 'protector') {
                if (typeof renderVaultState === 'function') renderVaultState();
            } else if (target === 'wellness') {
                updateHydrationUI();
            }
        });
    });

    // ─── HYDRATION TRACKING LOGIC ─────────────────────────────────────────────
    const addGlassBtn = document.getElementById('addGlassBtn');
    const glassesToGo = document.getElementById('glassesToGo');
    const waterToggle = document.getElementById('waterToggle');
    const segmentBtns = document.querySelectorAll('.segment-btn');
    const glassIcon = document.querySelector('.glass-icon');

    function getActiveInterval() {
        const activeBtn = document.querySelector('.segment-btn.active');
        return parseInt(activeBtn.dataset.val);
    }

    function setHydrationAlarm() {
        if (waterToggle.checked) {
            chrome.storage.local.get(['hydrationRemainingMs'], (res) => {
                if (res.hydrationRemainingMs && res.hydrationRemainingMs > 0) {
                    chrome.alarms.create('hydrationAlarm', { 
                        when: Date.now() + res.hydrationRemainingMs,
                        periodInMinutes: getActiveInterval()
                    });
                    chrome.storage.local.remove('hydrationRemainingMs');
                } else {
                    chrome.alarms.create('hydrationAlarm', { periodInMinutes: getActiveInterval() });
                }
            });
        } else {
            chrome.alarms.get('hydrationAlarm', (alarm) => {
                if (alarm) {
                    chrome.storage.local.set({ hydrationRemainingMs: alarm.scheduledTime - Date.now() });
                }
                chrome.alarms.clear('hydrationAlarm');
            });
        }
    }

    waterToggle.addEventListener('change', setHydrationAlarm);

    segmentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            segmentBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const interval = parseInt(btn.dataset.val);
            chrome.storage.local.set({ hydrationInterval: interval }, () => {
                chrome.storage.local.remove('hydrationRemainingMs', () => {
                    setHydrationAlarm();
                });
            });
        });
    });

    const waterGlassSize = document.getElementById('waterGlassSize');
    const waterDailyTarget = document.getElementById('waterDailyTarget');

    function saveHydrationSettings() {
        if (!waterGlassSize || !waterDailyTarget) return;
        const size = parseInt(waterGlassSize.value) || 250;
        const targetMl = parseInt(waterDailyTarget.value) || 2000;
        const calculatedGoal = Math.round(targetMl / size);

        chrome.storage.local.get(['hydrationState'], (result) => {
            let state = result.hydrationState || { todayIntake: 0, goal: 8, date: '', glassSize: 250 };
            state.glassSize = size;
            state.goal = calculatedGoal;
            chrome.storage.local.set({ hydrationState: state }, () => {
                updateHydrationUI();
            });
        });
    }

    if (waterGlassSize) {
        waterGlassSize.addEventListener('change', saveHydrationSettings);
    }
    if (waterDailyTarget) {
        waterDailyTarget.addEventListener('input', saveHydrationSettings);
    }

    function updateHydrationUI() {
        chrome.storage.local.get(['hydrationState'], (result) => {
            let state = result.hydrationState || { todayIntake: 0, goal: 8, date: '', glassSize: 250 };
            const d = new Date();
            const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            if (state.date !== todayStr) {
                state.todayIntake = 0;
                state.date = todayStr;
                chrome.storage.local.set({ hydrationState: state });
            }

            const glassSize = state.glassSize || 250;
            const goal = state.goal || 8;
            let remaining = goal - state.todayIntake;
            const consumedMl = state.todayIntake * glassSize;
            const goalMl = goal * glassSize;

            if (waterGlassSize && document.activeElement !== waterGlassSize) {
                waterGlassSize.value = glassSize;
            }
            if (waterDailyTarget && document.activeElement !== waterDailyTarget) {
                waterDailyTarget.value = goalMl;
            }
            
            if (state.todayIntake >= goal) {
                glassIcon.classList.add('goal-reached');
                if (state.todayIntake === goal) {
                    glassesToGo.innerHTML = `Goal crushed! 🎉<div style="font-size: 0.8rem; color: #64748b; font-weight: 500; margin-top: 4px;">You've had ${state.todayIntake} glasses (${consumedMl} ml)</div>`;
                } else {
                    glassesToGo.innerHTML = `${state.todayIntake} glasses (${consumedMl} ml)<div style="font-size: 0.8rem; color: #059669; font-weight: 600; margin-top: 4px;">Overachiever! 🚀</div>`;
                }
            } else {
                glassIcon.classList.remove('goal-reached');
                glassesToGo.innerHTML = `${remaining} glasses to go<div style="font-size: 0.8rem; color: #64748b; font-weight: 500; margin-top: 4px;">Consumed: ${consumedMl} / ${goalMl} ml</div>`;
            }
        });
    }

    addGlassBtn.addEventListener('click', () => {
        chrome.storage.local.get(['hydrationState'], (result) => {
            let state = result.hydrationState || { todayIntake: 0, goal: 8, date: '', glassSize: 250 };
            const d = new Date();
            const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            if (state.date !== todayStr) {
                state.todayIntake = 0;
                state.date = todayStr;
            }
            state.todayIntake += 1;
            chrome.storage.local.set({ hydrationState: state });
            
            // Sync to analytics history
            chrome.storage.local.get(['hydrationHistory'], (historyResult) => {
                let history = historyResult.hydrationHistory || {};
                history[todayStr] = state.todayIntake;
                chrome.storage.local.set({ hydrationHistory: history }, () => {
                    updateHydrationUI();
                });
            });
        });
    });

    document.getElementById('viewAnalyticsBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('analytics/analytics.html') });
    });

    // Reset Hydration
    const resetHydrationBtn = document.getElementById('resetHydrationBtn');
    if (resetHydrationBtn) {
        resetHydrationBtn.addEventListener('click', () => {
            showCustomConfirm('Reset Hydration', 'Are you sure you want to reset today\'s hydration intake to 0 ml?', () => {
                chrome.storage.local.get(['hydrationState'], (result) => {
                    let state = result.hydrationState || { todayIntake: 0, goal: 8, date: '', glassSize: 250 };
                    state.todayIntake = 0;
                    const d = new Date();
                    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    state.date = todayStr;
                    chrome.storage.local.set({ hydrationState: state }, () => {
                        chrome.storage.local.get(['hydrationHistory'], (historyResult) => {
                            let history = historyResult.hydrationHistory || {};
                            history[todayStr] = 0;
                            chrome.storage.local.set({ hydrationHistory: history }, () => {
                                updateHydrationUI();
                            });
                        });
                    });
                });
            });
        });
    }

    // Reset EyeGuard
    const resetEyeGuardBtn = document.getElementById('resetEyeGuardBtn');
    if (resetEyeGuardBtn) {
        resetEyeGuardBtn.addEventListener('click', () => {
            showCustomConfirm('Reset EyeGuard', 'Are you sure you want to clear EyeGuard stats and history?', () => {
                chrome.storage.local.set({ eyeGuardHistory: [] }, () => {
                    chrome.storage.local.get(['eyeGuardState'], (result) => {
                        let state = result.eyeGuardState || { interval: 20 };
                        state.nextBreak = Date.now() + (state.interval || 20) * 60 * 1000;
                        chrome.storage.local.set({ eyeGuardState: state }, () => {
                            if (typeof nextBreakTimeEl !== 'undefined' && nextBreakTimeEl) {
                                nextBreakTimeEl.textContent = formatTimeRemaining(state.nextBreak - Date.now());
                            }
                            chrome.alarms.create('eyeGuardAlarm', { periodInMinutes: state.interval || 20 });
                        });
                    });
                });
            });
        });
    }

    // Reset Focus
    const resetFocusBtn = document.getElementById('resetFocusBtn');
    if (resetFocusBtn) {
        resetFocusBtn.addEventListener('click', () => {
            showCustomConfirm('Reset Focus Stats', 'Are you sure you want to reset tasks completion and clear focus history?', () => {
                chrome.storage.local.get(['tasks'], (result) => {
                    let tasks = result.tasks || [];
                    tasks = tasks.map(t => ({
                        ...t,
                        completed: false,
                        timeLeft: t.time * 60
                    }));
                    chrome.storage.local.set({
                        tasks: tasks,
                        focusHistory: {},
                        focusHistorySessions: []
                    }, () => {
                        localTasks = tasks;
                        renderTasksAndBuckets();
                    });
                });
            });
        });
    }

    // Reset Prayer
    const resetPrayerBtn = document.getElementById('resetPrayerBtn');
    if (resetPrayerBtn) {
        resetPrayerBtn.addEventListener('click', () => {
            showCustomConfirm('Reset Prayer Data', 'Are you sure you want to restore prayers to default and clear weekly prayer history?', () => {
                const defaultPrayers = [
                    { id: 'p-fajr', name: 'Fajr', time: '05:00', enabled: true },
                    { id: 'p-zlugar', name: 'Zlugar', time: '12:30', enabled: true },
                    { id: 'p-asar', name: 'Asar', time: '15:45', enabled: true },
                    { id: 'p-magrib', name: 'Magrib', time: '18:30', enabled: true },
                    { id: 'p-isha', name: 'Isha', time: '20:00', enabled: true }
                ];
                chrome.storage.local.set({
                    prayers: defaultPrayers,
                    prayerHistory: {},
                    prayerNoHistory: {}
                }, () => {
                    if (typeof renderPrayers === 'function') {
                        renderPrayers();
                    }
                });
            });
        });
    }

    // Initial hydration load
    chrome.storage.local.get(['hydrationInterval'], (result) => {
        const interval = result.hydrationInterval || 30;
        segmentBtns.forEach(btn => {
            if (parseInt(btn.dataset.val) === interval) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        updateHydrationUI();
    });

    // ─── EYEGUARD LOGIC ───────────────────────────────────────────────────────
    const breakInterval = document.getElementById('breakInterval');
    const intervalVal = document.getElementById('intervalVal');
    const nextBreakTimeEl = document.getElementById('nextBreakTime');

    // Initial EyeGuard load
    chrome.storage.local.get(['eyeGuardState'], (result) => {
        const state = result.eyeGuardState || { nextBreak: Date.now() + 20 * 60 * 1000, interval: 20 };
        const interval = state.interval || 20;
        breakInterval.value = interval;
        intervalVal.textContent = `${interval} min`;
    });

    breakInterval.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        intervalVal.textContent = `${val} min`;
    });

    breakInterval.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        chrome.storage.local.get(['eyeGuardState'], (result) => {
            let state = result.eyeGuardState || {};
            state.interval = val;
            state.nextBreak = Date.now() + val * 60 * 1000;
            chrome.storage.local.set({ eyeGuardState: state }, () => {
                chrome.alarms.create('eyeGuardAlarm', { periodInMinutes: val });
            });
        });
    });

    // Dino Game Launch listener removed

    // Live Alarms Countdowns
    const hydrationCountdownEl = document.getElementById('hydrationCountdown');
    
    function formatTimeRemaining(ms) {
        if (ms < 0) return "00:00";
        let totalSeconds = Math.floor(ms / 1000);
        let minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        let seconds = (totalSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    let hydration10sNotified = false;
    let water1MinDismissed = false;

    function updateCountdowns() {
        if (!waterToggle.checked) {
            hydrationCountdownEl.textContent = "Reminders Paused";
            hydration10sNotified = false;
        } else {
            chrome.alarms.get('hydrationAlarm', (alarm) => {
                if (alarm) {
                    const remaining = alarm.scheduledTime - Date.now();
                    hydrationCountdownEl.textContent = `Next reminder: ${formatTimeRemaining(remaining)}`;
                    
                    if (remaining <= 60000 && remaining > 0) {
                        addNotification('hyd-1min', 'Almost Time! 💧', 'Almost time to drink water (in < 1 min)!', 'info', '💧');
                    }
                    
                    if (remaining <= 10000 && remaining > 0 && !hydration10sNotified) {
                        hydration10sNotified = true;
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: chrome.runtime.getURL('icon128.png'),
                            title: 'Almost Time! 💧',
                            message: 'Hydration reminder in 10 seconds!'
                        });
                    } else if (remaining > 10000 || remaining < 0) {
                        hydration10sNotified = false;
                    }
                } else {
                    hydrationCountdownEl.textContent = "Reminders Paused";
                }
            });
        }
        
        chrome.alarms.get('eyeGuardAlarm', (alarm) => {
            if (alarm) {
                nextBreakTimeEl.textContent = formatTimeRemaining(alarm.scheduledTime - Date.now());
            }
        });
    }

    setInterval(updateCountdowns, 1000);
    updateCountdowns();

    // ─── FOCUS AREA LOGIC (PER-TASK TIMERS, SEARCH, FILTERS) ──────────────────
    const taskSearchInput = document.getElementById('taskSearchInput');
    const bucketFilterSelect = document.getElementById('bucketFilterSelect');
    const bucketsContainer = document.getElementById('bucketsContainer');
    
    // Create Bucket Modal DOM
    const openCreateBucketModalBtn = document.getElementById('openCreateBucketModalBtn');
    const createBucketModal = document.getElementById('createBucketModal');
    const modalBucketName = document.getElementById('modalBucketName');
    const modalBucketDate = document.getElementById('modalBucketDate');
    const modalBucketCancelBtn = document.getElementById('modalBucketCancelBtn');
    const modalBucketCreateBtn = document.getElementById('modalBucketCreateBtn');

    let pomodoroInterval;

    function formatDateString(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10);
        const day = parts[2];
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        if (monthNum >= 1 && monthNum <= 12) {
            const formattedDay = day.padStart(2, '0');
            const monthName = months[monthNum - 1];
            return `${formattedDay}-${monthName}-${year}`;
        }
        return dateStr;
    }

    function setDatePickerValue(element, value) {
        if (!element) return;
        if (element._flatpickr) {
            element._flatpickr.setDate(value || '');
        } else {
            element.value = value || '';
        }
    }

    // Set default date picker value (local timezone YYYY-MM-DD)
    const d = new Date();
    const todayLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let currentFocusDate = todayLocal;

    const focusDatePicker = document.getElementById('focusDatePicker');
    if (focusDatePicker) {
        setDatePickerValue(focusDatePicker, todayLocal);
        focusDatePicker.addEventListener('change', (e) => {
            currentFocusDate = e.target.value;
            renderTasksAndBuckets();
        });
    }

    taskSearchInput.addEventListener('input', renderTasksAndBuckets);
    bucketFilterSelect.addEventListener('change', renderTasksAndBuckets);

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function updateBucketFilterDropdown(buckets, selectedValue) {
        bucketFilterSelect.innerHTML = '<option value="all">All Buckets</option>';
        buckets.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            if (b.id === selectedValue) {
                opt.selected = true;
            }
            bucketFilterSelect.appendChild(opt);
        });
    }

    function renderTasksAndBuckets() {
        const selectedDate = currentFocusDate;
        const searchQuery = taskSearchInput.value.toLowerCase().trim();
        const selectedBucketId = bucketFilterSelect.value;

        const dateBuckets = localBuckets.filter(b => !b.date || b.date === selectedDate);
        const hasSelectedBucket = dateBuckets.some(b => b.id === selectedBucketId);
        const activeBucketId = hasSelectedBucket ? selectedBucketId : 'all';
        if (!hasSelectedBucket && selectedBucketId !== 'all') {
            bucketFilterSelect.value = 'all';
        }
        updateBucketFilterDropdown(dateBuckets, activeBucketId);

        bucketsContainer.innerHTML = '';
        
        let bucketsToRender = [...dateBuckets];
        if (activeBucketId !== 'all') {
            bucketsToRender = bucketsToRender.filter(b => b.id === activeBucketId);
        }

        if (bucketsToRender.length === 0) {
            bucketsContainer.innerHTML = `<div class="empty-state">No task buckets found.</div>`;
            return;
        }

        const pomodoroState = localPomodoroState;

            bucketsToRender.forEach(bucket => {
                let bucketTasks = localTasks.filter(t => t.bucketId === bucket.id && t.date === selectedDate);
                
                // Calculate completion percentage of all tasks in the bucket (unfiltered by search query)
                const totalTasksCount = bucketTasks.length;
                const completedTasksCount = bucketTasks.filter(t => t.completed).length;
                const completionPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

                bucketTasks.sort((a, b) => {
                    const pA = a.priority !== undefined ? a.priority : 4;
                    const pB = b.priority !== undefined ? b.priority : 4;
                    if (pA !== pB) {
                        return pA - pB;
                    }
                    return localTasks.indexOf(a) - localTasks.indexOf(b);
                });

                if (searchQuery) {
                    bucketTasks = bucketTasks.filter(t => t.name.toLowerCase().includes(searchQuery));
                }

                // Sum the active task times
                const totalMinutes = bucketTasks.reduce((sum, t) => sum + t.time, 0);
                const totalHours = Math.floor(totalMinutes / 60);
                const totalMinsLeft = totalMinutes % 60;
                let timeString = '';
                if (totalMinutes === 0) {
                    timeString = '0m';
                } else {
                    if (totalHours > 0) timeString += `${totalHours}h `;
                    if (totalMinsLeft > 0 || totalHours === 0) timeString += `${totalMinsLeft}m`;
                }

                // Format Bucket Date for Display (e.g. 25-May-2026)
                let dateDisplayString = 'Always';
                if (bucket.date) {
                    const parts = bucket.date.split('-');
                    if (parts.length === 3) {
                        const year = parts[0];
                        const monthIndex = parseInt(parts[1], 10) - 1;
                        const day = parseInt(parts[2], 10);
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const monthName = months[monthIndex] || parts[1];
                        const dayStr = String(day).padStart(2, '0');
                        dateDisplayString = `${dayStr}-${monthName}-${year}`;
                    }
                }

                if (bucketTasks.length === 0 && searchQuery) {
                    return; // hide bucket if searching and no match
                }

                const isCollapsed = bucket.collapsed || false;
                const shouldOpenForm = window.openAddFormBucketId === bucket.id;
                if (shouldOpenForm) {
                    window.openAddFormBucketId = null;
                }

                const bucketEl = document.createElement('div');
                bucketEl.className = 'bucket-card';
                bucketEl.dataset.id = bucket.id;
                bucketEl.style.borderLeft = `5px solid ${bucket.colorCode || '#ea580c'}`;
                bucketEl.draggable = false; // set to true dynamically on mousedown

                bucketEl.innerHTML = `
                    <div class="bucket-header">
                        <div class="bucket-header-top">
                            <div class="bucket-info">
                                <div class="drag-handle" title="Drag to reorder bucket">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <circle cx="9" cy="5" r="1.5"></circle>
                                        <circle cx="9" cy="12" r="1.5"></circle>
                                        <circle cx="9" cy="19" r="1.5"></circle>
                                        <circle cx="15" cy="5" r="1.5"></circle>
                                        <circle cx="15" cy="12" r="1.5"></circle>
                                        <circle cx="15" cy="19" r="1.5"></circle>
                                    </svg>
                                </div>
                                <button class="toggle-bucket-collapse-btn" title="${isCollapsed ? 'Expand' : 'Collapse'}" style="background: none; border: none; padding: 2px; cursor: pointer; display: flex; align-items: center; color: ${bucket.colorCode || '#ea580c'}; margin-right: 2px;">
                                    ${isCollapsed ? 
                                        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>` : 
                                        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`
                                    }
                                </button>
                                <span class="bucket-title" style="color: ${bucket.colorCode || '#ea580c'};">${escapeHTML(bucket.name)}</span>
                            </div>
                            <div class="bucket-badges">
                                ${bucket.date ? `<span class="bucket-date-badge">${dateDisplayString}</span>` : ''}
                                <span class="bucket-completion-badge">${completionPercentage}%</span>
                                <span class="bucket-time-badge">${timeString}</span>
                            </div>
                        </div>
                        <div class="bucket-actions">
                            <button class="add-task-toggle-btn" title="Add Task">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                            <button class="view-tasks-popup-btn" title="View Tasks Checklist" style="background: none; border: none; padding: 3px; cursor: pointer; display: flex; align-items: center; color: #94a3b8; transition: all 0.2s; border-radius: 4px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            </button>
                            <button class="edit-bucket-btn" title="Edit Bucket" style="background: none; border: none; padding: 3px; cursor: pointer; display: flex; align-items: center; color: #94a3b8; transition: all 0.2s; border-radius: 4px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </button>
                            <button class="reuse-bucket-btn" title="Reuse for Next Day" style="background: none; border: none; padding: 3px; cursor: pointer; display: flex; align-items: center; color: #94a3b8; transition: all 0.2s; border-radius: 4px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
                            </button>
                            <button class="delete-bucket-btn" title="Delete Bucket">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="inline-add-task-form" style="display: ${shouldOpenForm ? 'block' : 'none'};">
                        <div class="task-form-row-simple">
                            <input type="text" class="task-name-input" placeholder="Task name..." style="margin-bottom: 6px;" maxlength="23">
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                                <input type="checkbox" class="task-timer-checkbox" style="cursor: pointer; width: 14px; height: 14px;">
                                <span style="font-size: 0.75rem; color: #475569; user-select: none;">Enable Timer</span>
                            </div>
                            <select class="task-duration-select" style="margin-bottom: 6px; display: none;">
                                <option value="5">5m Limit</option>
                                <option value="10">10m Limit</option>
                                <option value="15">15m Limit</option>
                                <option value="20">20m Limit</option>
                                <option value="25" selected>25m Limit</option>
                                <option value="30">30m Limit</option>
                                <option value="40">40m Limit</option>
                                <option value="60">60m Limit</option>
                                <option value="90">90m Limit</option>
                                <option value="120">120m Limit</option>
                            </select>
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                                <span style="font-size: 0.75rem; color: #475569; user-select: none; flex-shrink: 0;">Priority:</span>
                                <select class="task-priority-select" style="font-size: 0.75rem; padding: 2px 4px; border-radius: 4px; border: 1px solid #cbd5e1; outline: none; background: #ffffff; color: #334155; flex: 1;">
                                    <option value="1">1 - Top Priority</option>
                                    <option value="2">2 - High</option>
                                    <option value="3">3 - Medium</option>
                                    <option value="4" selected>4 - Low Priority</option>
                                </select>
                            </div>
                            <div class="form-btn-group">
                                <button class="cancel-add-task-btn">Cancel</button>
                                <button class="submit-add-task-btn">Add</button>
                            </div>
                        </div>
                    </div>

                    <div class="tasks-list" style="display: ${isCollapsed ? 'none' : 'flex'};"></div>
                `;

                // Handle draggable attribute dynamically so click events on inner controls are not blocked
                bucketEl.addEventListener('mousedown', (e) => {
                    const isHandle = e.target.closest('.drag-handle') || e.target.closest('.bucket-header');
                    const isInteractive = e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('.tasks-list');
                    if (isHandle && !isInteractive) {
                        bucketEl.draggable = true;
                    } else {
                        bucketEl.draggable = false;
                    }
                });

                // Drag & Drop event listeners
                bucketEl.addEventListener('dragstart', (e) => {
                    draggedBucketId = bucket.id;
                    e.dataTransfer.setData('text/plain', bucket.id);
                    bucketEl.classList.add('dragging');
                    setTimeout(() => {
                        bucketEl.style.opacity = '0.4';
                    }, 0);
                });

                bucketEl.addEventListener('dragend', () => {
                    draggedBucketId = null;
                    bucketEl.draggable = false;
                    bucketEl.classList.remove('dragging');
                    bucketEl.style.opacity = '1';
                    const cards = bucketsContainer.querySelectorAll('.bucket-card');
                    cards.forEach(card => {
                        card.classList.remove('drag-over-top');
                        card.classList.remove('drag-over-bottom');
                    });
                });

                bucketEl.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedBucketId) {
                        if (draggedBucketId === bucket.id) return;
                        const bounding = bucketEl.getBoundingClientRect();
                        const offset = e.clientY - bounding.top;
                        if (offset < bounding.height / 2) {
                            bucketEl.classList.add('drag-over-top');
                            bucketEl.classList.remove('drag-over-bottom');
                        } else {
                            bucketEl.classList.add('drag-over-bottom');
                            bucketEl.classList.remove('drag-over-top');
                        }
                    } else if (draggedTaskId) {
                        const draggedTask = localTasks.find(t => t.id === draggedTaskId);
                        if (draggedTask && draggedTask.bucketId !== bucket.id) {
                            bucketEl.classList.add('drag-over-bucket');
                        }
                    }
                });

                bucketEl.addEventListener('dragleave', () => {
                    bucketEl.classList.remove('drag-over-top');
                    bucketEl.classList.remove('drag-over-bottom');
                    bucketEl.classList.remove('drag-over-bucket');
                });

                bucketEl.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (draggedBucketId) {
                        const draggedId = draggedBucketId;
                        const targetId = bucket.id;
                        if (!draggedId || draggedId === targetId) return;

                        const bounding = bucketEl.getBoundingClientRect();
                        const offset = e.clientY - bounding.top;
                        const insertAfter = offset >= bounding.height / 2;

                        reorderBuckets(draggedId, targetId, insertAfter);
                    } else if (draggedTaskId) {
                        const draggedId = draggedTaskId;
                        const targetBucketId = bucket.id;
                        moveTaskToBucket(draggedId, targetBucketId);
                    }
                    bucketEl.classList.remove('drag-over-bucket');
                });

                const tasksListEl = bucketEl.querySelector('.tasks-list');
                
                if (bucketTasks.length === 0) {
                    tasksListEl.innerHTML = `<div class="empty-tasks">No tasks.</div>`;
                } else {
                    bucketTasks.forEach(task => {
                        const hasTimer = task.time > 0;
                        const isRunning = hasTimer && pomodoroState.status === 'running' && pomodoroState.activeTaskId === task.id;
                        const isPaused = hasTimer && pomodoroState.status === 'paused' && pomodoroState.activeTaskId === task.id;
                        
                        let secondsDisplay = task.timeLeft !== undefined ? task.timeLeft : (task.time * 60);
                        if (isRunning) {
                            let now = Date.now();
                            secondsDisplay = Math.max(0, Math.floor((pomodoroState.endTime - now) / 1000));
                        } else if (isPaused) {
                            secondsDisplay = pomodoroState.timeLeft;
                        }

                        const taskEl = document.createElement('div');
                        taskEl.className = `task-item-wrapper`;
                        taskEl.dataset.id = task.id;
                        taskEl.innerHTML = `
                            <div class="task-item ${task.completed ? 'completed' : ''} ${isRunning ? 'running' : ''}" data-id="${task.id}">
                                <div class="task-item-top">
                                    <div class="task-item-left">
                                        <div class="task-drag-handle" title="Drag to reorder task">
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                                <circle cx="9" cy="5" r="1.5"></circle>
                                                <circle cx="9" cy="12" r="1.5"></circle>
                                                <circle cx="9" cy="19" r="1.5"></circle>
                                                <circle cx="15" cy="5" r="1.5"></circle>
                                                <circle cx="15" cy="12" r="1.5"></circle>
                                                <circle cx="15" cy="19" r="1.5"></circle>
                                            </svg>
                                        </div>
                                        <label class="task-checkbox-label">
                                            <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                                            <span class="checkmark"></span>
                                        </label>
                                        <span class="task-title-text"><span class="task-priority-badge priority-${task.priority || 4}">P${task.priority || 4}</span>${escapeHTML(task.name)}</span>
                                    </div>
                                    ${hasTimer ? `<span class="task-timer-text">${formatTime(secondsDisplay)}</span>` : ''}
                                </div>
                                <div class="task-item-actions">
                                    ${hasTimer ? `
                                        <button class="play-task-timer-btn" title="${isRunning ? 'Pause' : 'Play'}">
                                            ${isRunning ? 
                                                `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : 
                                                `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
                                            }
                                        </button>
                                        <button class="reset-task-timer-btn" title="Reset Timer">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                        </button>
                                    ` : ''}
                                    <button class="edit-task-btn" title="Edit Task">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                    </button>
                                    <button class="delete-task-btn" title="Delete Task">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="task-inline-edit" style="display: none;">
                                <input type="text" class="edit-task-name-input" value="${escapeHTML(task.name)}" style="margin-bottom: 6px;" maxlength="23">
                                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                                    <input type="checkbox" class="edit-task-timer-checkbox" ${task.time > 0 ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px;">
                                    <span style="font-size: 0.75rem; color: #475569; user-select: none;">Enable Timer</span>
                                </div>
                                <select class="edit-task-duration-select" style="margin-bottom: 8px; ${task.time > 0 ? '' : 'display: none;'}">
                                    <option value="5" ${task.time === 5 ? 'selected' : ''}>5m Limit</option>
                                    <option value="10" ${task.time === 10 ? 'selected' : ''}>10m Limit</option>
                                    <option value="15" ${task.time === 15 ? 'selected' : ''}>15m Limit</option>
                                    <option value="20" ${task.time === 20 ? 'selected' : ''}>20m Limit</option>
                                    <option value="25" ${task.time === 25 || task.time === 0 ? 'selected' : ''}>25m Limit</option>
                                    <option value="30" ${task.time === 30 ? 'selected' : ''}>30m Limit</option>
                                    <option value="40" ${task.time === 40 ? 'selected' : ''}>40m Limit</option>
                                    <option value="60" ${task.time === 60 ? 'selected' : ''}>60m Limit</option>
                                    <option value="90" ${task.time === 90 ? 'selected' : ''}>90m Limit</option>
                                    <option value="120" ${task.time === 120 ? 'selected' : ''}>120m Limit</option>
                                </select>
                                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                                    <span style="font-size: 0.75rem; color: #475569; user-select: none; flex-shrink: 0;">Priority:</span>
                                    <select class="edit-task-priority-select" style="font-size: 0.75rem; padding: 2px 4px; border-radius: 4px; border: 1px solid #cbd5e1; outline: none; background: #ffffff; color: #334155; flex: 1;">
                                        <option value="1" ${task.priority === 1 ? 'selected' : ''}>1 - Top Priority</option>
                                        <option value="2" ${task.priority === 2 ? 'selected' : ''}>2 - High</option>
                                        <option value="3" ${task.priority === 3 ? 'selected' : ''}>3 - Medium</option>
                                        <option value="4" ${task.priority === 4 || task.priority === undefined ? 'selected' : ''}>4 - Low Priority</option>
                                    </select>
                                </div>
                                <div class="edit-btn-group" style="display: flex; gap: 4px; justify-content: flex-end;">
                                    <button class="cancel-edit-task-btn cancel-add-task-btn" style="height: 28px;">Cancel</button>
                                    <button class="save-edit-task-btn submit-add-task-btn" style="height: 28px;">Save</button>
                                </div>
                            </div>
                        `;

                        // Task list listeners
                        taskEl.querySelector('.task-checkbox').addEventListener('change', (e) => {
                            const isChecked = e.target.checked;
                            const innerItem = taskEl.querySelector('.task-item');
                            if (isChecked) {
                                innerItem.classList.add('completed');
                            } else {
                                innerItem.classList.remove('completed');
                            }
                            toggleTaskCompleted(task.id, isChecked);
                        });

                        // Task drag-and-drop listener registrations
                        taskEl.addEventListener('mousedown', (e) => {
                            const isHandle = e.target.closest('.task-drag-handle');
                            if (isHandle) {
                                taskEl.draggable = true;
                            } else {
                                taskEl.draggable = false;
                            }
                        });

                        taskEl.addEventListener('dragstart', (e) => {
                            draggedTaskId = task.id;
                            e.dataTransfer.setData('text/plain', task.id);
                            taskEl.classList.add('dragging-task');
                            setTimeout(() => {
                                taskEl.style.opacity = '0.4';
                            }, 0);
                            e.stopPropagation();
                        });

                        taskEl.addEventListener('dragend', () => {
                            draggedTaskId = null;
                            taskEl.draggable = false;
                            taskEl.classList.remove('dragging-task');
                            taskEl.style.opacity = '1';
                            const items = bucketsContainer.querySelectorAll('.task-item-wrapper');
                            items.forEach(item => {
                                item.classList.remove('drag-over-task-top');
                                item.classList.remove('drag-over-task-bottom');
                            });
                        });

                        taskEl.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            if (!draggedTaskId || draggedTaskId === task.id) return;
                            e.stopPropagation();

                            const bounding = taskEl.getBoundingClientRect();
                            const offset = e.clientY - bounding.top;
                            if (offset < bounding.height / 2) {
                                taskEl.classList.add('drag-over-task-top');
                                taskEl.classList.remove('drag-over-task-bottom');
                            } else {
                                taskEl.classList.add('drag-over-task-bottom');
                                taskEl.classList.remove('drag-over-task-top');
                            }
                        });

                        taskEl.addEventListener('dragleave', () => {
                            taskEl.classList.remove('drag-over-task-top');
                            taskEl.classList.remove('drag-over-task-bottom');
                        });

                        taskEl.addEventListener('drop', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const draggedId = draggedTaskId;
                            const targetId = task.id;
                            if (!draggedId || draggedId === targetId) return;

                            const bounding = taskEl.getBoundingClientRect();
                            const offset = e.clientY - bounding.top;
                            const insertAfter = offset >= bounding.height / 2;

                            reorderTasks(draggedId, targetId, insertAfter);
                        });

                        if (hasTimer) {
                            taskEl.querySelector('.play-task-timer-btn').addEventListener('click', () => {
                                if (isRunning) {
                                    pauseActiveTaskTimer();
                                } else {
                                    playTaskTimer(task.id);
                                }
                            });

                            taskEl.querySelector('.reset-task-timer-btn').addEventListener('click', () => {
                                resetTaskTimer(task.id);
                            });
                        }

                        taskEl.querySelector('.delete-task-btn').addEventListener('click', () => {
                            showCustomConfirm(
                                'Delete Task',
                                `Are you sure you want to delete the task "${task.name}"?`,
                                () => {
                                    deleteTask(task.id);
                                }
                            );
                        });

                        // Edit task button listeners
                        const editBtn = taskEl.querySelector('.edit-task-btn');
                        const editPanel = taskEl.querySelector('.task-inline-edit');
                        const taskRow = taskEl.querySelector('.task-item');
                        const editNameInput = taskEl.querySelector('.edit-task-name-input');
                        const editDurationSelect = taskEl.querySelector('.edit-task-duration-select');

                        editBtn.addEventListener('click', () => {
                            const isHidden = editPanel.style.display === 'none';
                            editPanel.style.display = isHidden ? 'block' : 'none';
                            taskRow.style.display = isHidden ? 'none' : 'flex';
                            if (isHidden) editNameInput.focus();
                        });

                        const editTimerCheckbox = taskEl.querySelector('.edit-task-timer-checkbox');

                        editTimerCheckbox.addEventListener('change', () => {
                            editDurationSelect.style.display = editTimerCheckbox.checked ? 'block' : 'none';
                        });

                        taskEl.querySelector('.cancel-edit-task-btn').addEventListener('click', () => {
                            editPanel.style.display = 'none';
                            taskRow.style.display = 'flex';
                        });

                        taskEl.querySelector('.save-edit-task-btn').addEventListener('click', () => {
                            const newName = editNameInput.value.trim().substring(0, 23);
                            if (!newName) {
                                editNameInput.focus();
                                return;
                            }
                            const newDuration = editTimerCheckbox.checked ? parseInt(editDurationSelect.value) : 0;
                            const editPrioritySelect = taskEl.querySelector('.edit-task-priority-select');
                            const newPriority = parseInt(editPrioritySelect.value);
                            saveEditTask(task.id, newName, newDuration, newPriority);
                        });

                        tasksListEl.appendChild(taskEl);
                    });
                }

                // Inline form listener
                const toggleAddBtn = bucketEl.querySelector('.add-task-toggle-btn');
                const form = bucketEl.querySelector('.inline-add-task-form');
                const nameInput = bucketEl.querySelector('.task-name-input');
                
                toggleAddBtn.addEventListener('click', () => {
                    if (bucket.collapsed) {
                        localBuckets = localBuckets.map(b => {
                            if (b.id === bucket.id) {
                                return { ...b, collapsed: false };
                            }
                            return b;
                        });
                        window.openAddFormBucketId = bucket.id;
                        chrome.storage.local.set({ taskBuckets: localBuckets });
                    } else {
                        const isHidden = form.style.display === 'none';
                        form.style.display = isHidden ? 'block' : 'none';
                        const emptyTasksEl = tasksListEl.querySelector('.empty-tasks');
                        if (emptyTasksEl) {
                            emptyTasksEl.style.display = isHidden ? 'none' : 'block';
                        }
                        if (isHidden) nameInput.focus();
                    }
                });

                const timerCheckbox = bucketEl.querySelector('.task-timer-checkbox');
                const durationSelect = bucketEl.querySelector('.task-duration-select');

                bucketEl.querySelector('.cancel-add-task-btn').addEventListener('click', () => {
                    form.style.display = 'none';
                    const emptyTasksEl = tasksListEl.querySelector('.empty-tasks');
                    if (emptyTasksEl) {
                        emptyTasksEl.style.display = 'block';
                    }
                    nameInput.value = '';
                    timerCheckbox.checked = false;
                    durationSelect.style.display = 'none';
                });

                timerCheckbox.addEventListener('change', () => {
                    durationSelect.style.display = timerCheckbox.checked ? 'block' : 'none';
                });

                bucketEl.querySelector('.submit-add-task-btn').addEventListener('click', () => {
                    const name = nameInput.value.trim().substring(0, 23);
                    if (!name) {
                        nameInput.focus();
                        return;
                    }
                    const duration = timerCheckbox.checked ? parseInt(durationSelect.value) : 0;
                    const prioritySelect = bucketEl.querySelector('.task-priority-select');
                    const priority = parseInt(prioritySelect.value);
                    addTask(bucket.id, name, duration, priority);
                });

                bucketEl.querySelector('.delete-bucket-btn').addEventListener('click', () => {
                    showCustomConfirm(
                        'Delete Bucket',
                        `Delete bucket "${bucket.name}" and all its tasks?`,
                        () => {
                            deleteBucket(bucket.id);
                        }
                    );
                });

                bucketEl.querySelector('.toggle-bucket-collapse-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleBucketCollapse(bucket.id);
                });

                bucketEl.querySelector('.edit-bucket-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditBucketModal(bucket);
                });

                bucketEl.querySelector('.view-tasks-popup-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    openTasksPopupModal(bucket.id);
                });

                bucketEl.querySelector('.reuse-bucket-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    reuseBucketForNextDay(bucket);
                });

                bucketsContainer.appendChild(bucketEl);
            });

            if (pomodoroState.status === 'running') {
                startGlobalTick();
            }
    }

    function reorderBuckets(draggedId, targetId, insertAfter) {
        const draggedIndex = localBuckets.findIndex(b => b.id === draggedId);
        if (draggedIndex === -1) return;

        const [draggedBucket] = localBuckets.splice(draggedIndex, 1);
        
        let targetIndex = localBuckets.findIndex(b => b.id === targetId);
        if (targetIndex === -1) {
            // fallback if target is not found (should not happen)
            localBuckets.push(draggedBucket);
        } else {
            let newTargetIndex = targetIndex;
            if (insertAfter) {
                newTargetIndex += 1;
            }
            localBuckets.splice(newTargetIndex, 0, draggedBucket);
        }
        chrome.storage.local.set({ taskBuckets: localBuckets });
    }

    function toggleBucketCollapse(bucketId) {
        localBuckets = localBuckets.map(b => {
            if (b.id === bucketId) {
                return { ...b, collapsed: !b.collapsed };
            }
            return b;
        });
        chrome.storage.local.set({ taskBuckets: localBuckets });
    }

    function reorderTasks(draggedId, targetId, insertAfter) {
        const draggedIndex = localTasks.findIndex(t => t.id === draggedId);
        if (draggedIndex === -1) return;

        const [draggedTask] = localTasks.splice(draggedIndex, 1);
        
        const targetIndex = localTasks.findIndex(t => t.id === targetId);
        if (targetIndex === -1) {
            localTasks.push(draggedTask);
        } else {
            const targetTask = localTasks[targetIndex];
            draggedTask.bucketId = targetTask.bucketId;
            draggedTask.priority = targetTask.priority !== undefined ? targetTask.priority : 4;
            
            let newTargetIndex = targetIndex;
            if (insertAfter) {
                newTargetIndex += 1;
            }
            localTasks.splice(newTargetIndex, 0, draggedTask);
        }
        chrome.storage.local.set({ tasks: localTasks });
    }

    function moveTaskToBucket(draggedId, targetBucketId) {
        const task = localTasks.find(t => t.id === draggedId);
        if (!task || task.bucketId === targetBucketId) return;

        task.bucketId = targetBucketId;
        
        const index = localTasks.indexOf(task);
        if (index > -1) {
            localTasks.splice(index, 1);
            localTasks.push(task);
        }
        chrome.storage.local.set({ tasks: localTasks });
    }

    function addTask(bucketId, name, duration, priority) {
        const selectedDate = currentFocusDate;
        const exists = localTasks.some(t => t.bucketId === bucketId && t.date === selectedDate && t.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            showCustomAlert('Duplicate Task', `A task named "${name}" already exists in this bucket for today.`);
            return;
        }

        const newTask = {
            id: 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            bucketId: bucketId,
            name: name,
            time: duration,
            timeLeft: duration * 60,
            completed: false,
            date: selectedDate,
            priority: priority !== undefined ? priority : 4
        };
        localTasks.unshift(newTask);
        chrome.storage.local.set({ tasks: localTasks });
    }

    function deleteTask(taskId) {
        localTasks = localTasks.filter(t => t.id !== taskId);
        
        chrome.storage.local.get(['pomodoroState'], (result) => {
            let state = result.pomodoroState || {};
            if (state.activeTaskId === taskId) {
                state.status = 'idle';
                delete state.activeTaskId;
                delete state.activeTaskName;
                delete state.activeBucketId;
                delete state.activeBucketName;
                chrome.storage.local.set({ pomodoroState: state });
            }
        });
        
        chrome.storage.local.set({ tasks: localTasks });
    }

    function toggleTaskCompleted(taskId, completed) {
        localTasks = localTasks.map(t => {
            if (t.id === taskId) {
                const taskCopy = { ...t, completed: completed };
                if (completed) {
                    taskCopy.timeLeft = (t.time || 0) * 60;
                }
                return taskCopy;
            }
            return t;
        });

        chrome.storage.local.get(['pomodoroState'], (result) => {
            let state = result.pomodoroState || {};
            if (state.activeTaskId === taskId && completed) {
                state.status = 'idle';
                state.timeLeft = 1500;
                delete state.activeTaskId;
                delete state.activeTaskName;
                delete state.activeBucketId;
                delete state.activeBucketName;
                chrome.storage.local.set({ pomodoroState: state }, () => {
                    chrome.alarms.clear('pomodoroEnd');
                    chrome.storage.local.set({ tasks: localTasks });
                });
            } else {
                chrome.storage.local.set({ tasks: localTasks });
            }
        });
    }

    function saveEditTask(taskId, newName, newDuration, newPriority) {
        let durationChanged = false;
        let taskIndex = localTasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const originalTask = localTasks[taskIndex];
        durationChanged = originalTask.time !== newDuration;

        const updatedTask = {
            ...originalTask,
            name: newName,
            time: newDuration,
            timeLeft: durationChanged ? (newDuration * 60) : originalTask.timeLeft,
            priority: newPriority !== undefined ? newPriority : 4
        };

        localTasks.splice(taskIndex, 1);
        localTasks.unshift(updatedTask);

        chrome.storage.local.get(['pomodoroState'], (result) => {
            let state = result.pomodoroState || {};
            if (state.activeTaskId === taskId && (newDuration === 0 || durationChanged)) {
                state.status = 'idle';
                state.timeLeft = newDuration * 60;
                delete state.activeTaskId;
                delete state.activeTaskName;
                delete state.activeBucketId;
                delete state.activeBucketName;
                chrome.storage.local.set({ pomodoroState: state }, () => {
                    chrome.alarms.clear('pomodoroEnd');
                    chrome.storage.local.set({ tasks: localTasks }, () => {
                        renderTasksAndBuckets();
                    });
                });
            } else {
                chrome.storage.local.set({ tasks: localTasks }, () => {
                    renderTasksAndBuckets();
                });
            }
        });
    }

    function deleteBucket(bucketId) {
        localBuckets = localBuckets.filter(b => b.id !== bucketId);
        localTasks = localTasks.filter(t => t.bucketId !== bucketId);
        
        chrome.storage.local.get(['pomodoroState'], (result) => {
            let state = result.pomodoroState || {};
            if (state.activeBucketId === bucketId) {
                state.status = 'idle';
                delete state.activeTaskId;
                delete state.activeTaskName;
                delete state.activeBucketId;
                delete state.activeBucketName;
                chrome.storage.local.set({ pomodoroState: state });
            }
        });

        chrome.storage.local.set({ taskBuckets: localBuckets, tasks: localTasks }, () => {
            renderTasksAndBuckets();
        });
    }

    // Modal Create Bucket Action Buttons
    const colorDots = document.querySelectorAll('.color-dot');
    colorDots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            colorDots.forEach(d => d.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    openCreateBucketModalBtn.addEventListener('click', () => {
        editingBucketId = null;
        document.getElementById('modalBucketTitle').textContent = 'Create Task Bucket';
        document.getElementById('modalBucketCreateBtn').textContent = 'Create';

        modalBucketName.value = '';
        setDatePickerValue(modalBucketDate, currentFocusDate);
        colorDots.forEach((d, index) => {
            if (index === 0) d.classList.add('active');
            else d.classList.remove('active');
        });
        createBucketModal.classList.add('active');
        modalBucketName.focus();
    });

    modalBucketCancelBtn.addEventListener('click', () => {
        createBucketModal.classList.remove('active');
    });

    modalBucketCreateBtn.addEventListener('click', () => {
        const name = modalBucketName.value.trim().substring(0, 11);
        if (!name) {
            modalBucketName.focus();
            return;
        }
        const selectedDate = modalBucketDate.value;
        if (!selectedDate) {
            modalBucketDate.focus();
            return;
        }
        
        if (editingBucketId) {
            const exists = localBuckets.some(b => b.id !== editingBucketId && b.name.toLowerCase() === name.toLowerCase() && b.date === selectedDate);
            if (exists) {
                showCustomAlert('Duplicate Bucket', `A bucket named "${name}" already exists for this date.`);
                return;
            }

            const activeColorDot = document.querySelector('.color-dot.active');
            const colorCode = activeColorDot ? activeColorDot.dataset.color : '#ea580c';

            const bucketIndex = localBuckets.findIndex(b => b.id === editingBucketId);
            if (bucketIndex > -1) {
                const updatedBucket = {
                    ...localBuckets[bucketIndex],
                    name: name,
                    date: selectedDate,
                    colorCode: colorCode
                };
                localBuckets.splice(bucketIndex, 1);
                localBuckets.unshift(updatedBucket);
            }
            
            editingBucketId = null;
            createBucketModal.classList.remove('active');
            chrome.storage.local.set({ taskBuckets: localBuckets });
        } else {
            const exists = localBuckets.some(b => b.name.toLowerCase() === name.toLowerCase() && b.date === selectedDate);
            if (exists) {
                showCustomAlert('Duplicate Bucket', `A bucket named "${name}" already exists for this date.`);
                return;
            }

            const activeColorDot = document.querySelector('.color-dot.active');
            const colorCode = activeColorDot ? activeColorDot.dataset.color : '#ea580c';

            const newBucket = {
                id: 'b-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: name,
                date: selectedDate,
                colorCode: colorCode
            };
            
            localBuckets.unshift(newBucket);
            createBucketModal.classList.remove('active');
            chrome.storage.local.set({ taskBuckets: localBuckets });
        }
    });

    function openEditBucketModal(bucket) {
        editingBucketId = bucket.id;
        
        document.getElementById('modalBucketTitle').textContent = 'Edit Task Bucket';
        document.getElementById('modalBucketCreateBtn').textContent = 'Save';
        
        modalBucketName.value = bucket.name;
        setDatePickerValue(modalBucketDate, bucket.date || currentFocusDate);
        
        const color = bucket.colorCode || '#ea580c';
        colorDots.forEach(d => {
            if (d.dataset.color === color) {
                d.classList.add('active');
            } else {
                d.classList.remove('active');
            }
        });
        
        createBucketModal.classList.add('active');
        modalBucketName.focus();
    }

    function getNextDayDate(dateStr) {
        if (!dateStr) return dateStr;
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            date.setDate(date.getDate() + 1);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
        return dateStr;
    }

    function reuseBucketForNextDay(bucket) {
        const nextDay = getNextDayDate(bucket.date || currentFocusDate);
        
        const exists = localBuckets.some(b => b.name.toLowerCase() === bucket.name.toLowerCase() && b.date === nextDay);
        if (exists) {
            showCustomAlert('Duplicate Bucket', `A bucket named "${bucket.name}" already exists for tomorrow (${nextDay}).`);
            return;
        }

        const newBucketId = 'b-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const newBucket = {
            id: newBucketId,
            name: bucket.name,
            date: nextDay,
            colorCode: bucket.colorCode || '#ea580c',
            collapsed: bucket.collapsed || false
        };

        const isGreen = (bucket.colorCode || '') === '#10b981';
        const currentTasks = localTasks.filter(t => t.bucketId === bucket.id);

        // Green bucket: copy ALL tasks but clear every checkbox (fresh slate)
        // Non-green bucket: copy ONLY unchecked tasks — drop completed ones
        const tasksToCopy = isGreen
            ? currentTasks
            : currentTasks.filter(t => !t.completed);

        const newTasks = tasksToCopy.map(t => ({
            id: 't-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9) + '-' + Math.random().toString(36).substr(2, 5),
            bucketId: newBucketId,
            name: t.name,
            time: t.time || 0,
            timeLeft: (t.time || 0) * 60,
            completed: false,   // always clear checkbox
            date: nextDay,
            priority: t.priority !== undefined ? t.priority : 4
        }));

        localBuckets.unshift(newBucket);
        localTasks = [...newTasks, ...localTasks];

        chrome.storage.local.set({ taskBuckets: localBuckets, tasks: localTasks }, () => {
            renderTasksAndBuckets();
            const copiedCount = newTasks.length;
            const skippedCount = currentTasks.length - copiedCount;
            const skippedNote = (!isGreen && skippedCount > 0) ? ` (${skippedCount} completed task${skippedCount > 1 ? 's' : ''} skipped)` : '';
            showCustomAlert('Tasks Copied', `Bucket "${bucket.name}" copied to tomorrow (${nextDay}) with ${copiedCount} task${copiedCount !== 1 ? 's' : ''}${skippedNote}!`);
        });
    }

    modalBucketName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') modalBucketCreateBtn.click();
    });

    function playTaskTimer(taskId) {
        chrome.storage.local.get(['pomodoroState'], (result) => {
            let state = result.pomodoroState || { status: 'idle' };
            
            if (state.status === 'running' && state.activeTaskId && state.activeTaskId !== taskId) {
                const runningTask = localTasks.find(t => t.id === state.activeTaskId);
                if (runningTask) {
                    let now = Date.now();
                    runningTask.timeLeft = Math.max(0, Math.floor((state.endTime - now) / 1000));
                }
            }

            const task = localTasks.find(t => t.id === taskId);
            const bucket = localBuckets.find(b => b.id === task.bucketId);
            if (!task) return;

            let durationSeconds = task.timeLeft !== undefined ? task.timeLeft : 1500;
            if (durationSeconds <= 0) {
                durationSeconds = 1500;
            }

            state.status = 'running';
            state.activeTaskId = task.id;
            state.activeTaskName = task.name;
            state.activeBucketId = task.bucketId;
            state.activeBucketName = bucket ? bucket.name : 'Unassigned';
            state.endTime = Date.now() + durationSeconds * 1000;
            state.timeLeft = durationSeconds;

            chrome.storage.local.set({ tasks: localTasks }, () => {
                chrome.storage.local.set({ pomodoroState: state }, () => {
                    chrome.alarms.create('pomodoroEnd', { when: state.endTime });
                });
            });
        });
    }

    function pauseActiveTaskTimer() {
        chrome.storage.local.get(['pomodoroState'], (result) => {
            let state = result.pomodoroState || {};
            if (state.status !== 'running') return;

            const task = localTasks.find(t => t.id === state.activeTaskId);
            let now = Date.now();
            let remaining = Math.max(0, Math.floor((state.endTime - now) / 1000));

            if (task) {
                task.timeLeft = remaining;
            }

            state.status = 'paused';
            state.timeLeft = remaining;

            chrome.storage.local.set({ tasks: localTasks }, () => {
                chrome.storage.local.set({ pomodoroState: state }, () => {
                    chrome.alarms.clear('pomodoroEnd');
                });
            });
        });
    }

    function resetTaskTimer(taskId) {
        const task = localTasks.find(t => t.id === taskId);
        if (!task) return;
        task.timeLeft = task.time * 60;

        chrome.storage.local.get(['pomodoroState'], (result) => {
            let state = result.pomodoroState || {};
            if (state.activeTaskId === taskId) {
                state.status = 'idle';
                state.timeLeft = task.time * 60;
                delete state.activeTaskId;
                delete state.activeTaskName;
                delete state.activeBucketId;
                delete state.activeBucketName;
                
                chrome.storage.local.set({ pomodoroState: state }, () => {
                    chrome.alarms.clear('pomodoroEnd');
                    chrome.storage.local.set({ tasks: localTasks });
                });
            } else {
                chrome.storage.local.set({ tasks: localTasks });
            }
        });
    }

    let globalTickInterval;
    function startGlobalTick() {
        if (globalTickInterval) clearInterval(globalTickInterval);
        globalTickInterval = setInterval(() => {
            let state = localPomodoroState;
            if (state.status === 'running') {
                let now = Date.now();
                if (now >= state.endTime) {
                    clearInterval(globalTickInterval);
                } else {
                    updateRunningTimerDisplays(state);
                }
            } else {
                clearInterval(globalTickInterval);
            }
        }, 1000);
    }

    function updateRunningTimerDisplays(state) {
        let now = Date.now();
        let secondsLeft = Math.max(0, Math.floor((state.endTime - now) / 1000));
        const timerDisplay = document.querySelector(`.task-item-wrapper[data-id="${state.activeTaskId}"] .task-timer-text`);
        if (timerDisplay) {
            timerDisplay.textContent = formatTime(secondsLeft);
        }
    }

    // ─── PRAYER TAB LOGIC ─────────────────────────────────────────────────────
    const newPrayerName = document.getElementById('newPrayerName');
    const newPrayerTime = document.getElementById('newPrayerTime');
    const createPrayerBtn = document.getElementById('createPrayerBtn');
    const prayerListContainer = document.getElementById('prayerListContainer');
    const demoPrayerAudioBtn = document.getElementById('demoPrayerAudioBtn');

    if (demoPrayerAudioBtn) {
        demoPrayerAudioBtn.addEventListener('click', () => {
            chrome.storage.local.get(['isAdhanPlaying'], (result) => {
                const isPlaying = result.isAdhanPlaying || false;
                if (isPlaying) {
                    chrome.runtime.sendMessage({ action: 'stopAdhan' });
                } else {
                    chrome.runtime.sendMessage({ action: 'testAdhan' });
                }
            });
        });
    }

    function updateAdhanButton(isPlaying) {
        const btn = document.getElementById('demoPrayerAudioBtn');
        if (!btn) return;
        if (isPlaying) {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
            btn.title = 'Stop Adhan';
            btn.classList.add('stop-adhan-active');
        } else {
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
            btn.title = 'Demo Adhan Audio';
            btn.classList.remove('stop-adhan-active');
        }
    }

    // Initialize button state
    chrome.storage.local.get(['isAdhanPlaying'], (result) => {
        updateAdhanButton(result.isAdhanPlaying || false);
    });

    createPrayerBtn.addEventListener('click', () => {
        const name = newPrayerName.value.trim();
        const time = newPrayerTime.value;
        if (!name) {
            newPrayerName.focus();
            return;
        }
        if (!time) {
            newPrayerTime.focus();
            return;
        }

        chrome.storage.local.get(['prayers'], (result) => {
            let prayers = result.prayers || [];
            prayers.push({
                id: 'p-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: name,
                time: time,
                enabled: true
            });
            chrome.storage.local.set({ prayers: prayers }, () => {
                newPrayerName.value = '';
                newPrayerTime.value = '';
                renderPrayers();
            });
        });
    });

    function getPrayerTargetDate(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const now = new Date();
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);
        
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }
        return target;
    }

    function formatTimeDiff(ms) {
        let seconds = Math.floor(ms / 1000);
        let hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        let minutes = Math.floor(seconds / 60);
        let secs = seconds % 60;
        
        let str = '';
        if (hours > 0) str += `${hours}h `;
        str += `${minutes}m ${secs}s`;
        return str;
    }

    function setPrayerAttendance(prayerId, attended) {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        chrome.storage.local.get(['prayerHistory', 'prayerNoHistory'], (result) => {
            let history = result.prayerHistory || {};
            let noHistory = result.prayerNoHistory || {};
            
            let todayHistory = history[todayStr] || [];
            let todayNoHistory = noHistory[todayStr] || [];
            
            if (attended) {
                if (!todayHistory.includes(prayerId)) {
                    todayHistory.push(prayerId);
                }
                todayNoHistory = todayNoHistory.filter(id => id !== prayerId);
            } else {
                todayHistory = todayHistory.filter(id => id !== prayerId);
                if (!todayNoHistory.includes(prayerId)) {
                    todayNoHistory.push(prayerId);
                }
            }
            
            history[todayStr] = todayHistory;
            noHistory[todayStr] = todayNoHistory;
            
            chrome.storage.local.set({ prayerHistory: history, prayerNoHistory: noHistory }, () => {
                renderPrayers();
            });
        });
    }

    function renderPrayers() {
        chrome.storage.local.get(['prayers', 'prayerHistory', 'prayerNoHistory'], (result) => {
            let prayers = result.prayers || [];
            let prayerHistory = result.prayerHistory || {};
            let prayerNoHistory = result.prayerNoHistory || {};
            
            // Set defaults if empty
            if (prayers.length === 0) {
                prayers = [
                    { id: 'p-fajr', name: 'Fajr', time: '05:00', enabled: true },
                    { id: 'p-zlugar', name: 'Zlugar', time: '12:30', enabled: true },
                    { id: 'p-asar', name: 'Asar', time: '15:45', enabled: true },
                    { id: 'p-magrib', name: 'Magrib', time: '18:30', enabled: true },
                    { id: 'p-isha', name: 'Isha', time: '20:00', enabled: true }
                ];
                chrome.storage.local.set({ prayers: prayers });
            }

            const d = new Date();
            const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const todayHistory = prayerHistory[todayStr] || [];
            const todayNoHistory = prayerNoHistory[todayStr] || [];

            prayerListContainer.innerHTML = '';
            
            const now = new Date();
            const nowHours = now.getHours();
            const nowMinutes = now.getMinutes();

            const prayersWithStatus = prayers.map(p => {
                const [h, m] = p.time.split(':').map(Number);
                const isTimePassed = nowHours > h || (nowHours === h && nowMinutes >= m);
                const target = getPrayerTargetDate(p.time);
                
                return {
                    ...p,
                    target,
                    isTimePassed,
                    sortTime: h * 60 + m
                };
            });

            const chronological = [...prayersWithStatus].sort((a, b) => a.sortTime - b.sortTime);
            prayersWithStatus.forEach(prayer => {
                const index = chronological.findIndex(c => c.id === prayer.id);
                const nextPrayer = chronological[index + 1];
                prayer.isExpired = nextPrayer ? nextPrayer.isTimePassed : false;
            });

            // Sort: Not visually completed first, then visually completed. Both sorted chronologically.
            prayersWithStatus.sort((a, b) => {
                const aAnswered = todayHistory.includes(a.id) || todayNoHistory.includes(a.id);
                const bAnswered = todayHistory.includes(b.id) || todayNoHistory.includes(b.id);
                const aVisuallyCompleted = aAnswered || a.isExpired;
                const bVisuallyCompleted = bAnswered || b.isExpired;
                
                if (aVisuallyCompleted !== bVisuallyCompleted) {
                    return aVisuallyCompleted ? 1 : -1;
                }
                return a.sortTime - b.sortTime;
            });

            prayersWithStatus.forEach(prayer => {
                const isAttended = todayHistory.includes(prayer.id);
                const isNoSelected = todayNoHistory.includes(prayer.id);
                const hasAnswered = isAttended || isNoSelected;
                const isVisuallyCompleted = hasAnswered || prayer.isExpired;
                
                const msDiff = prayer.target - Date.now();
                const isAlarmActive = prayer.enabled && !prayer.isTimePassed && msDiff > 0 && msDiff <= 7 * 60 * 1000;
                
                let timeRemainingStr = '';
                if (!prayer.enabled) {
                    timeRemainingStr = 'Paused';
                } else if (hasAnswered) {
                    timeRemainingStr = 'Completed today';
                } else if (isAlarmActive) {
                    timeRemainingStr = `⚠️ Starts in ${formatTimeDiff(msDiff)}`;
                } else if (prayer.isTimePassed) {
                    timeRemainingStr = 'Pending Input';
                } else {
                    timeRemainingStr = `In ${formatTimeDiff(msDiff)}`;
                }

                let [hours, minutes] = prayer.time.split(':');
                let suffix = parseInt(hours) >= 12 ? 'PM' : 'AM';
                let displayHours = parseInt(hours) % 12 || 12;
                let displayTime = `${displayHours}:${minutes} ${suffix}`;

                const isUpcoming = !prayer.isTimePassed;
                // Only disable if attendance is already recorded (not just because prayer time hasn't arrived yet)
                // This prevents all buttons being disabled on a new day when all prayers are "upcoming"
                const isDisabled = hasAnswered;

                const prayerEl = document.createElement('div');
                prayerEl.className = `prayer-row ${prayer.enabled ? '' : 'paused'} ${isVisuallyCompleted ? 'completed' : ''} ${isAlarmActive ? 'alarm-active' : ''}`;
                prayerEl.dataset.id = prayer.id;
                
                prayerEl.innerHTML = `
                    <div class="prayer-main-row">
                        <div class="prayer-top-line">
                            <span class="prayer-name">${escapeHTML(prayer.name)}</span>
                            <span class="prayer-time">${displayTime}</span>
                        </div>
                        <div class="prayer-bottom-line">
                            <span class="prayer-countdown" data-time="${prayer.time}">${timeRemainingStr}</span>
                            <div class="prayer-actions">
                                <button class="pause-prayer-btn" title="${prayer.enabled ? 'Pause' : 'Resume'}">
                                    ${prayer.enabled ? 
                                        `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>` : 
                                        `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
                                    }
                                </button>
                                <button class="edit-prayer-btn" title="Edit">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </button>
                                <button class="delete-prayer-btn" title="Delete">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                        <div class="prayer-attendance" style="display: flex; gap: 8px; margin-top: 6px; align-items: center; justify-content: flex-end; border-top: 1px dashed #f1f5f9; padding-top: 6px;">
                            <span style="font-size: 0.72rem; color: #64748b; font-weight: 500; margin-right: auto;">Attended?</span>
                            <button class="prayer-attendance-btn yes ${isAttended ? 'active' : ''}" ${isDisabled ? 'disabled' : ''}>Yes</button>
                            <button class="prayer-attendance-btn no ${isNoSelected ? 'active' : ''}" ${isDisabled ? 'disabled' : ''}>No</button>
                        </div>
                    </div>
                    
                    <div class="prayer-inline-edit" style="display: none;">
                        <input type="text" class="edit-prayer-name-input" value="${escapeHTML(prayer.name)}">
                        <input type="time" class="edit-prayer-time-input" value="${prayer.time}">
                        <div class="edit-btn-group">
                            <button class="cancel-edit-prayer-btn">Cancel</button>
                            <button class="save-edit-prayer-btn">Save</button>
                        </div>
                    </div>
                `;

                // Event bindings for prayers
                prayerEl.querySelector('.pause-prayer-btn').addEventListener('click', () => {
                    togglePrayerEnabled(prayer.id);
                });

                prayerEl.querySelector('.edit-prayer-btn').addEventListener('click', () => {
                    const editPanel = prayerEl.querySelector('.prayer-inline-edit');
                    editPanel.style.display = editPanel.style.display === 'none' ? 'block' : 'none';
                });

                prayerEl.querySelector('.cancel-edit-prayer-btn').addEventListener('click', () => {
                    prayerEl.querySelector('.prayer-inline-edit').style.display = 'none';
                });

                prayerEl.querySelector('.save-edit-prayer-btn').addEventListener('click', () => {
                    const newName = prayerEl.querySelector('.edit-prayer-name-input').value.trim();
                    const newTime = prayerEl.querySelector('.edit-prayer-time-input').value;
                    if (!newName || !newTime) return;
                    saveEditPrayer(prayer.id, newName, newTime);
                });

                prayerEl.querySelector('.delete-prayer-btn').addEventListener('click', () => {
                    showCustomConfirm(
                        'Delete Prayer',
                        `Are you sure you want to delete the prayer "${prayer.name}"?`,
                        () => {
                            deletePrayer(prayer.id);
                        }
                    );
                });

                prayerEl.querySelector('.prayer-attendance-btn.yes').addEventListener('click', () => {
                    setPrayerAttendance(prayer.id, true);
                });

                prayerEl.querySelector('.prayer-attendance-btn.no').addEventListener('click', () => {
                    setPrayerAttendance(prayer.id, false);
                });

                prayerListContainer.appendChild(prayerEl);
            });
        });
    }

    function togglePrayerEnabled(prayerId) {
        chrome.storage.local.get(['prayers'], (result) => {
            let prayers = result.prayers || [];
            prayers = prayers.map(p => p.id === prayerId ? { ...p, enabled: !p.enabled } : p);
            chrome.storage.local.set({ prayers: prayers });
        });
    }

    function saveEditPrayer(prayerId, name, time) {
        chrome.storage.local.get(['prayers'], (result) => {
            let prayers = result.prayers || [];
            prayers = prayers.map(p => p.id === prayerId ? { ...p, name: name, time: time } : p);
            chrome.storage.local.set({ prayers: prayers });
        });
    }

    function deletePrayer(prayerId) {
        chrome.storage.local.get(['prayers'], (result) => {
            let prayers = result.prayers || [];
            prayers = prayers.filter(p => p.id !== prayerId);
            chrome.storage.local.set({ prayers: prayers });
        });
    }

    let prayerCountdownInterval;
    function startPrayerCountdownTick() {
        if (prayerCountdownInterval) clearInterval(prayerCountdownInterval);
        prayerCountdownInterval = setInterval(() => {
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab && activeTab.getAttribute('data-target') === 'prayer') {
                const countdownEls = document.querySelectorAll('.prayer-countdown');
                let transitionTriggered = false;

                countdownEls.forEach(el => {
                    const rowEl = el.closest('.prayer-row');
                    if (!rowEl) return;
                    
                    const timeVal = el.getAttribute('data-time');
                    const isEnabled = !rowEl.classList.contains('paused');
                    
                    if (isEnabled) {
                        const [h, m] = timeVal.split(':').map(Number);
                        const now = new Date();
                        const isTimePassed = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
                        const isUpcoming = !isTimePassed;

                        // Check if we need to transition the button state
                        const yesBtn = rowEl.querySelector('.prayer-attendance-btn.yes');
                        if (yesBtn) {
                            const wasDisabled = yesBtn.disabled;
                            const hasAnswered = yesBtn.classList.contains('active') || rowEl.querySelector('.prayer-attendance-btn.no').classList.contains('active');
                            // Only disable when attendance already recorded (NOT when merely upcoming)
                            const shouldBeDisabled = hasAnswered;
                            
                            if (wasDisabled !== shouldBeDisabled) {
                                transitionTriggered = true;
                            }
                        }

                        if (isUpcoming) {
                            const target = getPrayerTargetDate(timeVal);
                            const msDiff = target - Date.now();
                            const isAlarmActive = msDiff > 0 && msDiff <= 7 * 60 * 1000;

                            rowEl.classList.remove('completed');
                            if (isAlarmActive) {
                                rowEl.classList.add('alarm-active');
                                el.textContent = `⚠️ Starts in ${formatTimeDiff(msDiff)}`;
                            } else {
                                rowEl.classList.remove('alarm-active');
                                el.textContent = `In ${formatTimeDiff(msDiff)}`;
                            }
                        } else {
                            // Prayer time has passed — check if attendance recorded
                            rowEl.classList.remove('alarm-active');
                            const yesBtn = rowEl.querySelector('.prayer-attendance-btn.yes');
                            const noBtn = rowEl.querySelector('.prayer-attendance-btn.no');
                            const hasAnswered = yesBtn?.classList.contains('active') || noBtn?.classList.contains('active');

                            if (hasAnswered) {
                                // Already recorded — show completed
                                if (el.textContent !== 'Completed today') {
                                    el.textContent = 'Completed today';
                                    rowEl.classList.add('completed');
                                }
                            } else {
                                // Passed but not yet answered — nudge for input
                                if (el.textContent !== 'Pending Input') {
                                    el.textContent = 'Pending Input';
                                    // Trigger re-render to re-sort this prayer to the right position
                                    transitionTriggered = true;
                                }
                            }
                        }
                    } else {
                        el.textContent = 'Paused';
                    }
                });

                if (transitionTriggered) {
                    renderPrayers();
                }
            }
        }, 1000);
    }

    // Initialize prayer data tick
    startPrayerCountdownTick();

    // ─── CARD RESET OPERATIONS ────────────────────────────────────────────────
    function triggerCardResetAnimation(cardEl, resetCallback) {
        cardEl.classList.add('card-reset-flash');
        setTimeout(() => {
            resetCallback();
        }, 250);
        setTimeout(() => {
            cardEl.classList.remove('card-reset-flash');
        }, 600);
    }

    document.getElementById('resetHydrationBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        showCustomConfirm(
            'Reset Hydration Data',
            "Are you sure you want to reset today's hydration intake and log history?",
            () => {
                const card = document.querySelector('.water-card');
                triggerCardResetAnimation(card, () => {
                    chrome.storage.local.set({ hydrationState: { todayIntake: 0, goal: 8 }, hydrationInterval: 30 }, () => {
                        chrome.storage.local.set({ hydrationHistory: {} }, () => {
                            updateHydrationUI();
                            segmentBtns.forEach(btn => btn.classList.remove('active'));
                            const defaultBtn = document.querySelector('.segment-btn[data-val="30"]');
                            if (defaultBtn) defaultBtn.classList.add('active');
                            setHydrationAlarm();
                        });
                    });
                });
            }
        );
    });

    document.getElementById('resetFocusBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        showCustomConfirm(
            'Reset Focus Data',
            "Are you sure you want to reset all tasks, buckets, and focus history?",
            () => {
                const card = document.querySelector('.focus-card');
                triggerCardResetAnimation(card, () => {
                    chrome.storage.local.set({ pomodoroState: { status: 'idle', timeLeft: 1500 } }, () => {
                        chrome.storage.local.set({
                            taskBuckets: [],
                            tasks: [],
                            focusHistory: {},
                            focusHistorySessions: []
                        }, () => {
                            chrome.alarms.clear('pomodoroEnd');
                        });
                    });
                });
            }
        );
    });

    document.getElementById('resetPrayerBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        showCustomConfirm(
            'Reset Prayer Settings',
            "Are you sure you want to reset all prayers back to default settings?",
            () => {
                const card = document.querySelector('.prayer-card');
                triggerCardResetAnimation(card, () => {
                    const defaultPrayers = [
                        { id: 'p-fajr', name: 'Fajr', time: '05:00', enabled: true },
                        { id: 'p-zlugar', name: 'Zlugar', time: '12:30', enabled: true },
                        { id: 'p-asar', name: 'Asar', time: '15:45', enabled: true },
                        { id: 'p-magrib', name: 'Magrib', time: '18:30', enabled: true },
                        { id: 'p-isha', name: 'Isha', time: '20:00', enabled: true }
                    ];
                    chrome.storage.local.set({ 
                        prayers: defaultPrayers,
                        lastNotifiedPrayers: { date: '', list: [] }
                    });
                });
            }
        );
    });

    document.getElementById('resetEyeGuardBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        showCustomConfirm(
            'Reset EyeGuard Settings',
            "Are you sure you want to reset EyeGuard interval settings and break logs?",
            () => {
                const card = document.querySelector('.eyeguard-card');
                triggerCardResetAnimation(card, () => {
                    chrome.storage.local.set({ eyeGuardState: { nextBreak: Date.now() + 20 * 60 * 1000, interval: 20 } }, () => {
                        chrome.storage.local.set({ eyeGuardHistory: [] }, () => {
                            breakInterval.value = 20;
                            intervalVal.textContent = "20 min";
                            chrome.alarms.create('eyeGuardAlarm', { periodInMinutes: 20 });
                        });
                    });
                });
            }
        );
    });

    // ─── GOOGLE OAuth & SYNC LOGIC ──────────────────────────────────────────
    const authGate = document.getElementById('authGate');
    const authGateSignInBtn = document.getElementById('authGateSignInBtn');
    const authGateGuestBtn = document.getElementById('authGateGuestBtn');
    const authGateError = document.getElementById('authGateError');
    const profileHeader = document.getElementById('profileHeader');
    const userProfileInfo = document.getElementById('userProfileInfo');
    const authPrompt = document.getElementById('authPrompt');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');

    function updateProfileUI() {
        chrome.storage.local.get(['userProfile'], (result) => {
            const profile = result.userProfile;
            if (profile && (profile.signedIn || profile.guest)) {
                if (authGate) authGate.classList.add('hidden');
                
                if (profile.guest) {
                    if (authPrompt) authPrompt.style.display = 'flex';
                    if (userProfileInfo) userProfileInfo.style.display = 'none';
                } else {
                    if (authPrompt) authPrompt.style.display = 'none';
                    if (userProfileInfo) userProfileInfo.style.display = 'flex';
                    if (userName) userName.textContent = profile.name || 'User';
                    if (userEmail) userEmail.textContent = profile.email || '';
                    
                    if (userAvatar) {
                        if (profile.picture) {
                            userAvatar.innerHTML = `<img src="${profile.picture}" referrerpolicy="no-referrer" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                            userAvatar.style.backgroundColor = 'transparent';
                        } else {
                            const firstLetter = (profile.name || profile.email || 'G').charAt(0).toUpperCase();
                            userAvatar.textContent = firstLetter;
                            const colors = ['#1a73e8', '#ea4335', '#fbbc05', '#34a853', '#8b5cf6', '#ec4899'];
                            const colorIndex = firstLetter.charCodeAt(0) % colors.length;
                            userAvatar.style.backgroundColor = colors[colorIndex];
                        }
                    }
                }
            } else {
                if (authGate) authGate.classList.remove('hidden');
                if (userProfileInfo) userProfileInfo.style.display = 'none';
                if (authPrompt) authPrompt.style.display = 'flex';
            }
        });
    }

    async function handleSignIn() {
        if (authGateSignInBtn) authGateSignInBtn.disabled = true;
        if (signInBtn) signInBtn.disabled = true;
        if (authGateError) authGateError.textContent = 'Connecting to Google...';

        try {
            await DriveSync.signIn();
            if (authGate) authGate.classList.add('hidden');
            updateProfileUI();
            if (authGateError) authGateError.textContent = '';
        } catch (err) {
            console.error('Sign in failed:', err);
            if (authGateError) {
                authGateError.textContent = err.message || 'Failed to sign in. Please try again.';
            }
        } finally {
            if (authGateSignInBtn) authGateSignInBtn.disabled = false;
            if (signInBtn) signInBtn.disabled = false;
        }
    }

    if (authGateSignInBtn) {
        authGateSignInBtn.addEventListener('click', handleSignIn);
    }
    if (signInBtn) {
        signInBtn.addEventListener('click', handleSignIn);
    }
    if (authGateGuestBtn) {
        authGateGuestBtn.addEventListener('click', () => {
            const guestProfile = {
                signedIn: false,
                guest: true,
                name: 'Guest',
                email: 'Local Mode'
            };
            chrome.storage.local.set({ userProfile: guestProfile }, () => {
                if (authGate) authGate.classList.add('hidden');
                updateProfileUI();
            });
        });
    }

    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            showCustomConfirm(
                'Sign Out',
                'Are you sure you want to sign out? Your settings will remain, but you must sign in again to access the extension.',
                async () => {
                    try {
                        await DriveSync.signOut();
                        if (authGate) authGate.classList.remove('hidden');
                        updateProfileUI();
                    } catch (err) {
                        console.error('Sign out failed:', err);
                    }
                }
            );
        });
    }

    function updateSyncBadgeUI(status) {
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
                break;
            case 'offline':
                badge.textContent = '○ Offline';
                break;
            default:
                badge.textContent = '';
                break;
        }
    }

    // Check auth status on load
    chrome.storage.local.get(['userProfile'], async (result) => {
        const profile = result.userProfile || {};
        if (profile.signedIn) {
            if (authGate) authGate.classList.add('hidden');
            updateProfileUI();

            // Set initial sync badge from stored status
            chrome.storage.local.get(['syncStatus'], (result) => {
                if (result.syncStatus) {
                    updateSyncBadgeUI(result.syncStatus);
                }
            });

            try {
                // Silently pull latest data from Google Drive
                const token = await DriveSync.getAuthToken(false);
                await DriveSync.pullFromDrive(token);
            } catch (e) {
                console.warn('Initial Drive sync pull failed (possibly offline):', e.message);
                updateSyncBadgeUI('offline');
            }
        } else if (profile.guest) {
            if (authGate) authGate.classList.add('hidden');
            updateProfileUI();
            updateSyncBadgeUI('offline');
        } else {
            if (authGate) authGate.classList.remove('hidden');
            updateProfileUI();
        }
    });

    // ─── TASK POPUP MODAL FUNCTIONS ──────────────────────────────────────────
    let activeModalBucketId = null;

    function renderTasksModalContent(bucketId) {
        const bucket = localBuckets.find(b => b.id === bucketId);
        if (!bucket) return;

        const titleEl = document.getElementById('tasksModalTitle');
        titleEl.textContent = `${bucket.name} Tasks`;

        const listEl = document.getElementById('tasksModalList');
        listEl.innerHTML = '';

        const selectedDate = currentFocusDate;
        const bucketTasks = localTasks.filter(t => t.bucketId === bucketId && t.date === selectedDate);
        bucketTasks.sort((a, b) => {
            const pA = a.priority !== undefined ? a.priority : 4;
            const pB = b.priority !== undefined ? b.priority : 4;
            if (pA !== pB) {
                return pA - pB;
            }
            return localTasks.indexOf(a) - localTasks.indexOf(b);
        });

        if (bucketTasks.length === 0) {
            listEl.innerHTML = '<div class="empty-tasks" style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 12px 0;">No tasks in this bucket.</div>';
            return;
        }

        bucketTasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = `modal-task-item ${task.completed ? 'completed' : ''}`;
            taskEl.style.marginBottom = '6px';
            taskEl.innerHTML = `
                <label class="task-checkbox-label" style="margin-right: 8px;">
                    <input type="checkbox" class="modal-task-checkbox" ${task.completed ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <span class="modal-task-title" title="${escapeHTML(task.name)}">
                    <span class="task-priority-badge priority-${task.priority || 4}" style="margin-right: 4px;">P${task.priority || 4}</span>
                    ${escapeHTML(task.name)}
                </span>
                ${task.time > 0 ? `<span class="modal-task-time">${task.time}m</span>` : ''}
            `;

            taskEl.querySelector('.modal-task-checkbox').addEventListener('change', (e) => {
                toggleTaskCompleted(task.id, e.target.checked);
            });

            listEl.appendChild(taskEl);
        });
    }

    function openTasksPopupModal(bucketId) {
        activeModalBucketId = bucketId;
        renderTasksModalContent(bucketId);
        document.getElementById('bucketTasksModal').classList.add('active');
    }

    const tasksModalCloseBtn = document.getElementById('tasksModalCloseBtn');
    if (tasksModalCloseBtn) {
        tasksModalCloseBtn.addEventListener('click', () => {
            document.getElementById('bucketTasksModal').classList.remove('active');
            activeModalBucketId = null;
        });
    }

    const bucketTasksModal = document.getElementById('bucketTasksModal');
    if (bucketTasksModal) {
        bucketTasksModal.addEventListener('click', (e) => {
            if (e.target === bucketTasksModal) {
                bucketTasksModal.classList.remove('active');
                activeModalBucketId = null;
            }
        });
    }

    // ─── STORAGE SYNC LISTENERS ───────────────────────────────────────────────
    chrome.storage.onChanged.addListener((changes, namespace) => {
        let shouldRenderTasks = false;
        if (changes.taskBuckets) {
            localBuckets = changes.taskBuckets.newValue || [];
            shouldRenderTasks = true;
        }
        if (changes.tasks) {
            localTasks = changes.tasks.newValue || [];
            shouldRenderTasks = true;
        }
        if (changes.pomodoroState) {
            localPomodoroState = changes.pomodoroState.newValue || { status: 'idle', timeLeft: 1500 };
            shouldRenderTasks = true;
        }
        
        if (shouldRenderTasks) {
            renderTasksAndBuckets();
            if (activeModalBucketId) {
                renderTasksModalContent(activeModalBucketId);
            }
        }
        if (changes.prayers) {
            renderPrayers();
        }
        if (changes.userProfile) {
            updateProfileUI();
        }
        if (changes.syncStatus) {
            updateSyncBadgeUI(changes.syncStatus.newValue);
        }
        if (changes.reminders) {
            localReminders = changes.reminders.newValue || [];
            renderReminders();
        }
        if (changes.isAdhanPlaying) {
            updateAdhanButton(changes.isAdhanPlaying.newValue);
        }
    });

    // ─── REMINDERS LOGIC ─────────────────────────────────────────────
    let localReminders = [];
    const newReminderName = document.getElementById('newReminderName');
    const newReminderDate = document.getElementById('newReminderDate');
    const newReminderThreshold = document.getElementById('newReminderThreshold');
    const newReminderAmount = document.getElementById('newReminderAmount');
    const addReminderBtn = document.getElementById('addReminderBtn');
    const remindersListContainer = document.getElementById('remindersListContainer');

    const dRem = new Date();
    const todayStrRem = `${dRem.getFullYear()}-${String(dRem.getMonth() + 1).padStart(2, '0')}-${String(dRem.getDate()).padStart(2, '0')}`;
    if (newReminderDate) setDatePickerValue(newReminderDate, todayStrRem);
    if (newReminderThreshold) setDatePickerValue(newReminderThreshold, todayStrRem);

    function checkReminderNotifications() {
        chrome.storage.local.get(['reminders'], (result) => {
            const reminders = result.reminders || [];
            const today = new Date();
            today.setHours(0,0,0,0);
            
            reminders.forEach(rem => {
                if (rem.completed) return;
                
                const reminderDate = rem.threshold ? new Date(rem.threshold) : null;
                if (reminderDate) {
                    reminderDate.setHours(0,0,0,0);
                    if (today >= reminderDate) {
                        addNotification(`rem-${rem.id}`, 'Reminder Due', `${rem.name} reached its Reminder Date!`, 'warning', '⏰');
                    }
                }
            });
            const container = document.getElementById('popupNotificationContainer');
            if (container && container.children.length > 0) container.style.display = 'flex';
        });
    }

    function renderReminders() {
        if (!remindersListContainer) return;
        remindersListContainer.innerHTML = '';
        
        if (localReminders.length === 0) {
            remindersListContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;">No reminders yet. Add one above!</div>';
            return;
        }

        const searchTerm = (document.getElementById('searchReminderInput')?.value || '').toLowerCase();
        const filtered = localReminders.filter(rem => (rem.name || '').toLowerCase().includes(searchTerm));

        if (filtered.length === 0) {
            remindersListContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;">No reminders found.</div>';
            return;
        }

        const now = new Date();
        now.setHours(0,0,0,0);

        filtered.sort((a, b) => {
            const da = a.threshold ? new Date(a.threshold).getTime() : 0;
            const db = b.threshold ? new Date(b.threshold).getTime() : 0;
            return db - da;
        });

        filtered.forEach(rem => {
            const thresholdDate = rem.threshold ? new Date(rem.threshold) : null;
            if (thresholdDate) thresholdDate.setHours(0,0,0,0);

            let isApproaching = false;
            let isPast = false;
            
            if (thresholdDate) {
                const diffTime = thresholdDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= 2 && diffDays >= 0) {
                    isApproaching = true;
                } else if (diffDays < 0) {
                    isPast = true;
                }
            }

            const isCompleted = rem.completed || false;

            let bgStyle = "background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);";
            if (isCompleted) {
                bgStyle = "background: #f8fafc; border: 1px solid #e2e8f0; opacity: 0.75;";
            } else if (isApproaching) {
                bgStyle = "background: #fff7ed; border: 1px solid #fdba74; box-shadow: 0 2px 4px rgba(0,0,0,0.02);";
            } else if (isPast) {
                bgStyle = "background: #fef2f2; border: 1px solid #fca5a5; box-shadow: 0 2px 4px rgba(0,0,0,0.02);";
            }

            const el = document.createElement('div');
            el.style = bgStyle + " border-radius: 12px; padding: 14px; position: relative; margin-bottom: 8px; transition: transform 0.2s; cursor: default;";
            el.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 6px; padding-right: 80px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" class="complete-reminder-checkbox" ${isCompleted ? 'checked' : ''} data-id="${rem.id}" style="cursor: pointer; width: 16px; height: 16px; flex-shrink: 0; margin: 0; accent-color: #0ea5e9;">
                        <strong style="font-size: 1rem; color: ${isCompleted ? '#94a3b8' : '#0f172a'}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: ${isCompleted ? 'line-through' : 'none'};">${escapeHTML(rem.name)}</strong>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; padding-left: 24px; margin-top: 4px; font-size: 0.75rem; font-weight: 600;">
                        ${rem.date ? `<div style="display: flex; align-items: center; gap: 4px; background: rgba(148, 163, 184, 0.1); padding: 4px 8px; border-radius: 6px; color: #64748b;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Date: ${formatDateString(rem.date)}</div>` : ''}
                        ${rem.threshold ? `<div style="display: flex; align-items: center; gap: 4px; background: ${isCompleted ? 'rgba(148, 163, 184, 0.1)' : (isPast ? 'rgba(239, 68, 68, 0.1)' : (isApproaching ? 'rgba(234, 88, 12, 0.1)' : 'rgba(148, 163, 184, 0.1)'))}; padding: 4px 8px; border-radius: 6px; color: ${isCompleted ? '#94a3b8' : (isPast ? '#ef4444' : (isApproaching ? '#ea580c' : '#64748b'))};"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Remainder Date: ${formatDateString(rem.threshold)}</div>` : ''}
                        ${rem.amount ? `<div style="display: flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 6px; color: #10b981;">Amount: ₹${escapeHTML(String(rem.amount))}</div>` : ''}
                    </div>
                </div>
                <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 4px;">
                    <button class="view-reminder-btn" data-id="${rem.id}" style="background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 4px; transition: color 0.2s;" title="View">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button class="edit-reminder-btn" data-id="${rem.id}" style="background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 4px; transition: color 0.2s;" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="delete-reminder-btn" data-id="${rem.id}" style="background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 4px; transition: color 0.2s;" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;
            
            el.querySelector('.delete-reminder-btn').addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                localReminders = localReminders.filter(r => r.id !== id);
                chrome.storage.local.set({ reminders: localReminders }, () => {
                    checkReminderNotifications();
                });
                renderReminders();
            });

            el.querySelector('.edit-reminder-btn').addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const rem = localReminders.find(r => r.id === id);
                if (rem) {
                    document.getElementById('newReminderName').value = rem.name || '';
                    
                    const dateEl = document.getElementById('newReminderDate');
                    setDatePickerValue(dateEl, rem.date);

                    const thresholdEl = document.getElementById('newReminderThreshold');
                    setDatePickerValue(thresholdEl, rem.threshold);

                    document.getElementById('newReminderAmount').value = rem.amount || '';
                    localReminders = localReminders.filter(r => r.id !== id);
                    chrome.storage.local.set({ reminders: localReminders }, () => {
                        checkReminderNotifications();
                    });
                    renderReminders();
                }
            });

            el.querySelector('.view-reminder-btn').addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const rem = localReminders.find(r => r.id === id);
                if (rem) {
                    showCustomConfirm('View Reminder', `Name: ${rem.name}\nDate: ${formatDateString(rem.date) || 'N/A'}\nRemainder Date: ${formatDateString(rem.threshold) || 'N/A'}\nAmount: ${rem.amount || 'N/A'}`, () => {});
                }
            });

            el.querySelector('.complete-reminder-checkbox').addEventListener('change', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                const isChecked = e.currentTarget.checked;
                localReminders = localReminders.map(r => {
                    if (r.id === id) {
                        return { ...r, completed: isChecked };
                    }
                    return r;
                });
                chrome.storage.local.set({ reminders: localReminders }, () => {
                    renderReminders();
                    checkReminderNotifications();
                });
            });

            remindersListContainer.appendChild(el);
        });
    }

    const searchReminderInput = document.getElementById('searchReminderInput');
    if (searchReminderInput) {
        searchReminderInput.addEventListener('input', () => {
            renderReminders();
        });
    }

    if (addReminderBtn) {
        if (newReminderAmount) {
            newReminderAmount.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9.]/g, '');
            });
        }

        addReminderBtn.addEventListener('click', () => {
            const name = newReminderName.value.trim();
            if (!name) return;

            const rem = {
                id: 'rem-' + Date.now(),
                name: name,
                date: newReminderDate.value,
                threshold: newReminderThreshold.value,
                amount: newReminderAmount.value,
                completed: false,
                createdAt: new Date().toISOString()
            };

            localReminders.push(rem);
            chrome.storage.local.set({ reminders: localReminders }, () => {
                checkReminderNotifications();
            });
            renderReminders();

            newReminderName.value = '';
            newReminderAmount.value = '';
        });
    }

    // ─── PROTECTOR LOGIC ─────────────────────────────────────────────
    let localCredentials = [];
    let masterPasswordHash = null;
    let isVaultUnlocked = false;

    const protectorAuthView = document.getElementById('protectorAuthView');
    const protectorContentView = document.getElementById('protectorContentView');
    const masterPasswordInput = document.getElementById('masterPasswordInput');
    const unlockProtectorBtn = document.getElementById('unlockProtectorBtn');
    const setupMasterBtn = document.getElementById('setupMasterBtn');
    const lockProtectorBtn = document.getElementById('lockProtectorBtn');
    const protectorError = document.getElementById('protectorError');
    const newCredentialName = document.getElementById('newCredentialName');
    const newCredentialEnv = document.getElementById('newCredentialEnv');
    const newCredentialPurpose = document.getElementById('newCredentialPurpose');
    const newCredentialPass = document.getElementById('newCredentialPass');
    const addCredentialBtn = document.getElementById('addCredentialBtn');
    const credentialsListContainer = document.getElementById('credentialsListContainer');

    function renderVaultState() {
        if (!protectorAuthView) return;
        if (isVaultUnlocked) {
            protectorAuthView.style.display = 'none';
            protectorContentView.style.display = 'flex';
            
            // Add reset master password button if not exists
            if (!document.getElementById('resetMasterBtn')) {
                const resetBtn = document.createElement('button');
                resetBtn.id = 'resetMasterBtn';
                resetBtn.textContent = 'Reset Master Password';
                resetBtn.className = 'link-btn';
                resetBtn.style.marginTop = '15px';
                resetBtn.style.color = '#ef4444';
                resetBtn.style.fontWeight = '500';
                resetBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to reset the master password? This will delete all your saved credentials!')) {
                        masterPasswordHash = null;
                        localCredentials = [];
                        isVaultUnlocked = false;
                        chrome.storage.local.remove(['masterPasswordHash', 'credentials'], () => {
                            renderVaultState();
                        });
                    }
                });
                protectorContentView.appendChild(resetBtn);
            }

            renderCredentials();
        } else {
            protectorAuthView.style.display = 'flex';
            protectorContentView.style.display = 'none';
            masterPasswordInput.value = '';
            if (masterPasswordHash) {
                setupMasterBtn.style.display = 'none';
                unlockProtectorBtn.textContent = 'Unlock';
            } else {
                setupMasterBtn.style.display = 'block';
                unlockProtectorBtn.textContent = 'Setup Password';
            }
        }
    }

    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    if (unlockProtectorBtn) {
        unlockProtectorBtn.addEventListener('click', () => {
            const pass = masterPasswordInput.value.trim();
            if (!pass) return;

            if (!masterPasswordHash) {
                masterPasswordHash = simpleHash(pass);
                chrome.storage.local.set({ masterPasswordHash });
                isVaultUnlocked = true;
                protectorError.textContent = '';
                renderVaultState();
            } else {
                if (simpleHash(pass) === masterPasswordHash) {
                    isVaultUnlocked = true;
                    protectorError.textContent = '';
                    renderVaultState();
                } else {
                    protectorError.textContent = 'Incorrect password.';
                }
            }
        });
    }

    if (lockProtectorBtn) {
        lockProtectorBtn.addEventListener('click', () => {
            isVaultUnlocked = false;
            renderVaultState();
        });
    }

    function renderCredentials() {
        if (!credentialsListContainer) return;
        credentialsListContainer.innerHTML = '';
        
        if (localCredentials.length === 0) {
            credentialsListContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;">No saved credentials.</div>';
            return;
        }

        const searchTerm = (document.getElementById('searchCredentialInput')?.value || '').toLowerCase();
        const filtered = localCredentials.filter(cred => (cred.name || '').toLowerCase().includes(searchTerm));

        if (filtered.length === 0) {
            credentialsListContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;">No credentials found.</div>';
            return;
        }

        const eyeOpenSVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        const eyeClosedSVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

        filtered.forEach(cred => {
            const el = document.createElement('div');
            el.style = "background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; position: relative; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);";
            el.innerHTML = `
                <div class="cred-display-view">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <div style="width: 28px; height: 28px; border-radius: 6px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: #3b82f6;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <strong style="font-size: 0.95rem; color: #0f172a; font-weight: 600; line-height: 1.2;">${escapeHTML(cred.name)}</strong>
                            <span style="font-size: 0.7rem; color: #64748b;">${[cred.env ? 'Env: ' + escapeHTML(cred.env) : '', cred.purpose ? 'Purpose: ' + escapeHTML(cred.purpose) : ''].filter(Boolean).join(' | ') || 'Saved Credential'}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                        <span class="cred-pass-text" data-password="${escapeHTML(cred.password)}" style="flex: 1; font-size: 0.9rem; color: #334155; font-family: monospace; letter-spacing: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">••••••••</span>
                        <button class="toggle-pass-btn" title="Show/Hide password" style="background: none; border: none; cursor: pointer; color: #64748b; padding: 6px; display: flex; align-items: center; border-radius: 6px; transition: background 0.2s;">
                            ${eyeOpenSVG}
                        </button>
                        <button class="edit-cred-btn" title="Edit credential" style="background: none; border: none; cursor: pointer; color: #64748b; padding: 6px; display: flex; align-items: center; border-radius: 6px; transition: background 0.2s;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button class="delete-cred-btn" data-id="${cred.id}" title="Delete credential" style="background: none; border: none; cursor: pointer; color: #ef4444; padding: 6px; display: flex; align-items: center; border-radius: 6px; transition: background 0.2s;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="cred-edit-view" style="display: none; flex-direction: column; gap: 8px;">
                    <div style="font-size: 0.8rem; font-weight: 600; color: #475569;">Edit Credential</div>
                    <input type="text" class="edit-cred-name-input" value="${escapeHTML(cred.name)}" placeholder="Credential Name" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; outline: none; transition: border-color 0.2s; box-sizing: border-box;" />
                    <input type="text" class="edit-cred-env-input" value="${escapeHTML(cred.env || '')}" placeholder="Environment (e.g. Prod)" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; outline: none; transition: border-color 0.2s; box-sizing: border-box;" />
                    <input type="text" class="edit-cred-purpose-input" value="${escapeHTML(cred.purpose || '')}" placeholder="Purpose of use..." style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; outline: none; transition: border-color 0.2s; box-sizing: border-box;" />
                    <div style="position: relative; width: 100%;">
                        <input type="password" class="edit-cred-pass-input" value="${escapeHTML(cred.password)}" placeholder="Password" style="width: 100%; padding: 8px 36px 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; outline: none; transition: border-color 0.2s; box-sizing: border-box;" />
                        <button class="toggle-edit-pass-btn" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 4px; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; border-radius: 4px;">
                            ${eyeOpenSVG}
                        </button>
                    </div>
                    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
                        <button class="cancel-edit-cred-btn" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; cursor: pointer; font-weight: 500;">Cancel</button>
                        <button class="save-edit-cred-btn" style="padding: 6px 12px; font-size: 0.8rem; border-radius: 6px; border: none; background: #3b82f6; color: #ffffff; cursor: pointer; font-weight: 500;">Save</button>
                    </div>
                </div>
            `;

            const toggleBtn = el.querySelector('.toggle-pass-btn');
            toggleBtn.addEventListener('click', function() {
                const span = el.querySelector('.cred-pass-text');
                const isHidden = span.textContent === '        ';
                if (isHidden) {
                    span.textContent = span.getAttribute('data-password');
                    span.style.letterSpacing = 'normal';
                    this.innerHTML = eyeClosedSVG;
                } else {
                    span.textContent = '        ';
                    span.style.letterSpacing = '2px';
                    this.innerHTML = eyeOpenSVG;
                }
            });

            const displayView = el.querySelector('.cred-display-view');
            const editView = el.querySelector('.cred-edit-view');
            const editBtn = el.querySelector('.edit-cred-btn');
            const cancelBtn = el.querySelector('.cancel-edit-cred-btn');
            const saveBtn = el.querySelector('.save-edit-cred-btn');
            const nameInput = el.querySelector('.edit-cred-name-input');
            const envInput = el.querySelector('.edit-cred-env-input');
            const purposeInput = el.querySelector('.edit-cred-purpose-input');
            const passInput = el.querySelector('.edit-cred-pass-input');
            const toggleEditPassBtn = el.querySelector('.toggle-edit-pass-btn');

            toggleEditPassBtn.addEventListener('click', () => {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    toggleEditPassBtn.innerHTML = eyeClosedSVG;
                } else {
                    passInput.type = 'password';
                    toggleEditPassBtn.innerHTML = eyeOpenSVG;
                }
            });


            editBtn.addEventListener('click', () => {
                displayView.style.display = 'none';
                editView.style.display = 'flex';
                nameInput.focus();
                passInput.type = 'password';
                toggleEditPassBtn.innerHTML = eyeOpenSVG;
            });

            cancelBtn.addEventListener('click', () => {
                displayView.style.display = 'block';
                editView.style.display = 'none';
                nameInput.value = cred.name;
                passInput.value = cred.password;
                passInput.type = 'password';
                toggleEditPassBtn.innerHTML = eyeOpenSVG;
            });

            saveBtn.addEventListener('click', () => {
                const newName = nameInput.value.trim();
                const newEnv = envInput ? envInput.value.trim() : '';
                const newPurpose = purposeInput ? purposeInput.value.trim() : '';
                const newPass = passInput.value.trim();
                if (!newName || !newPass) return;

                localCredentials = localCredentials.map(c => {
                    if (c.id === cred.id) {
                        return { ...c, name: newName, env: newEnv, purpose: newPurpose, password: newPass };
                    }
                    return c;
                });

                chrome.storage.local.set({ credentials: localCredentials }, () => {
                    renderCredentials();
                });
            });

            el.querySelector('.delete-cred-btn').addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                localCredentials = localCredentials.filter(c => c.id !== id);
                chrome.storage.local.set({ credentials: localCredentials });
                renderCredentials();
            });

            credentialsListContainer.appendChild(el);
        });
    }

    const toggleNewCredentialPassBtn = document.getElementById('toggleNewCredentialPassBtn');
    if (toggleNewCredentialPassBtn) {
        toggleNewCredentialPassBtn.addEventListener('click', () => {
            const input = document.getElementById('newCredentialPass');
            if (input.type === 'password') {
                input.type = 'text';
                toggleNewCredentialPassBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
            } else {
                input.type = 'password';
                toggleNewCredentialPassBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            }
        });
    }

    const searchCredentialInput = document.getElementById('searchCredentialInput');
    if (searchCredentialInput) {
        searchCredentialInput.addEventListener('input', () => {
            renderCredentials();
        });
    }

    if (addCredentialBtn) {
        addCredentialBtn.addEventListener('click', () => {
            const name = newCredentialName.value.trim();
            const env = newCredentialEnv ? newCredentialEnv.value.trim() : '';
            const purpose = newCredentialPurpose ? newCredentialPurpose.value.trim() : '';
            const pass = newCredentialPass.value.trim();
            if (!name || !pass) return;

            localCredentials.push({
                id: 'cred-' + Date.now(),
                name: name,
                env: env,
                purpose: purpose,
                password: pass
            });
            chrome.storage.local.set({ credentials: localCredentials });

            newCredentialName.value = '';
            if (newCredentialEnv) newCredentialEnv.value = '';
            if (newCredentialPurpose) newCredentialPurpose.value = '';
            newCredentialPass.value = '';
            renderCredentials();
        });
    }

    // Fetch initial state for new features
    chrome.storage.local.get(['reminders'], (res) => {
        if (res.reminders) {
            localReminders = res.reminders;
            renderReminders();
        }
    });

    chrome.storage.local.get(['credentials', 'masterPasswordHash'], (res) => {
        if (res.credentials) localCredentials = res.credentials;
        if (res.masterPasswordHash) masterPasswordHash = res.masterPasswordHash;
        renderVaultState();
    });

    // --- Light / Dark Theme ---
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const sunIcon = themeToggleBtn?.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn?.querySelector('.moon-icon');

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if (sunIcon) sunIcon.style.display = 'none';
            if (moonIcon) moonIcon.style.display = 'block';
        } else {
            document.body.classList.remove('dark-theme');
            if (sunIcon) sunIcon.style.display = 'block';
            if (moonIcon) moonIcon.style.display = 'none';
        }
    }

    chrome.storage.local.get(['theme'], (res) => {
        const activeTheme = res.theme || 'light';
        applyTheme(activeTheme);
    });

    themeToggleBtn?.addEventListener('click', () => {
        chrome.storage.local.get(['theme'], (res) => {
            const currentTheme = res.theme || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            chrome.storage.local.set({ theme: newTheme }, () => {
                applyTheme(newTheme);
            });
        });
    });

});
