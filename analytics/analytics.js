// [[Node: Analytics_Data_Aggregation]]
document.addEventListener('DOMContentLoaded', () => {
    const todayIntakeEl = document.getElementById('todayIntake');
    const avgIntakeEl   = document.getElementById('avgIntake');
    const canvas        = document.getElementById('hydrationChart');
    const ctx           = canvas.getContext('2d');

    let hydrationGoal = 8;

    // ─── HYDRATION ANALYTICS ──────────────────────────────────────────────────

    function initDashboard() {
        chrome.storage.local.get(['hydrationHistory'], (syncResult) => {
            let history = syncResult.hydrationHistory || {};
            chrome.storage.local.get(['hydrationState'], (localResult) => {
                let localState = localResult.hydrationState || { todayIntake: 0, goal: 8 };
                hydrationGoal = localState.goal || 8;
                const d = new Date();
                let todayDate  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                history[todayDate] = localState.todayIntake;
                todayIntakeEl.textContent = localState.todayIntake;
                processAndDrawChart(history);
            });
        });
    }

    chrome.storage.local.get(['theme'], (res) => {
        if (res.theme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        initDashboard();
    });

    function processAndDrawChart(history) {
        let days = [], data = [], total = 0;
        for (let i = 6; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            let label   = d.toLocaleDateString('en-US', { weekday: 'short' });
            let amount  = history[dateStr] || 0;
            days.push(label);
            data.push(amount);
            total += amount;
        }
        avgIntakeEl.textContent = (total / 7).toFixed(1);
        animateBarChart(days, data);
    }

    function animateBarChart(labels, data) {
        const startTime = performance.now();
        const duration = 600; // 600ms animation
        
        function render(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
            
            drawBarChart(labels, data, easeProgress);
            
            if (progress < 1) {
                requestAnimationFrame(render);
            }
        }
        requestAnimationFrame(render);
    }

    function drawRoundedRect(ctx, x, y, width, height, radius) {
        if (height <= 0) return;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    function drawBarChart(labels, data, progress = 1) {
        const width = canvas.width, height = canvas.height, padding = 40;
        ctx.clearRect(0, 0, width, height);
        const maxVal      = Math.max(...data, hydrationGoal, 8);
        const chartWidth  = width  - padding * 2;
        const chartHeight = height - padding * 2;
        const barWidth    = (chartWidth / labels.length) - 20;

        const isDark = document.body.classList.contains('dark-theme');

        // Axes
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.strokeStyle = isDark ? '#334155' : '#cbd5e1'; // Dark/Light slate axis
        ctx.stroke();

        // Bars
        data.forEach((val, i) => {
            const animatedVal = val * progress;
            const barH = (animatedVal / maxVal) * chartHeight;
            const x    = padding + 10 + i * (chartWidth / labels.length);
            const y    = height - padding - barH;
            
            if (barH > 0) {
                // Draw premium gradient for hydration bars
                let grad = ctx.createLinearGradient(x, y, x, height - padding);
                grad.addColorStop(0, '#0ea5e9'); // sky 500
                grad.addColorStop(1, '#2563eb'); // blue 600
                ctx.fillStyle = grad;
                
                // Draw rounded rectangle for bar chart
                const radius = Math.min(8, barH);
                drawRoundedRect(ctx, x, y, barWidth, barH, radius);
                ctx.fill();
            }
            
            ctx.fillStyle   = isDark ? '#cbd5e1' : '#64748b'; // Dark/Light slate label
            ctx.font        = '500 12px Inter, sans-serif'; // Google Inter Font
            ctx.textAlign   = 'center';
            ctx.fillText(labels[i], x + barWidth / 2, height - padding + 20);
            
            // Only draw values if progress is near complete
            if (progress > 0.8 && val > 0) {
                ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a'; // Dark/Light slate value text
                ctx.fillText(val, x + barWidth / 2, y - 10);
            }
        });

        // Goal line
        const goalY = height - padding - ((hydrationGoal / maxVal) * chartHeight);
        ctx.beginPath();
        ctx.moveTo(padding, goalY);
        ctx.lineTo(width - padding, goalY);
        ctx.strokeStyle = isDark ? 'rgba(248, 250, 252, 0.15)' : 'rgba(15, 23, 42, 0.15)'; // Goal line transparency
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = isDark ? 'rgba(248, 250, 252, 0.6)' : 'rgba(15, 23, 42, 0.6)';
        ctx.textAlign = 'left';
        ctx.fillText(`Goal (${hydrationGoal})`, padding + 5, goalY - 5);
    }

    // ─── FOCUS MODE ANALYTICS ──────────────────────────────────────────────────

    const focusTotalEl = document.getElementById('focusTotal');
    const focusAvgEl   = document.getElementById('focusAvg');
    const focusPeakEl  = document.getElementById('focusPeak');
    const calendarEl   = document.getElementById('githubCalendar');

    function initFocusDashboard() {
        chrome.storage.local.get(['focusHistory', 'focusHistorySessions'], (resSync) => {
            chrome.storage.local.get(['focusSettings'], (resLocal) => {
                const history = resSync.focusHistory || {};
                const sessions = resSync.focusHistorySessions || [];
                const settings = resLocal.focusSettings || { focus: 25 };
                renderFocusStats(history);
                renderGithubCalendar(history, settings);
                renderFocusAreaAnalytics(sessions);
            });
        });
    }

    function renderFocusStats(history) {
        let totalSessions = 0;
        let totalMinutes = 0;
        
        const sortedDates = Object.keys(history).sort();
        let currentStreak = 0;

        sortedDates.forEach(dateStr => {
            let entry = history[dateStr];
            let count = typeof entry === 'number' ? entry : (entry?.count || 0);
            let mins  = typeof entry === 'number' ? (entry * 25) : (entry?.minutes || 0);
            totalSessions += count;
            totalMinutes += mins;
        });

        if (sortedDates.length > 0) {
            const getLocalDateStr = (dObj) => `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
            
            let todayStr = getLocalDateStr(new Date());
            
            const yesterdayObj = new Date();
            yesterdayObj.setDate(yesterdayObj.getDate() - 1);
            let yesterdayStr = getLocalDateStr(yesterdayObj);
            
            let checkDate = new Date();
            let entryToday = history[todayStr];
            let countToday = typeof entryToday === 'number' ? entryToday : (entryToday?.count || 0);
            
            let entryYesterday = history[yesterdayStr];
            let countYesterday = typeof entryYesterday === 'number' ? entryYesterday : (entryYesterday?.count || 0);
            
            if (countToday === 0) {
                checkDate.setDate(checkDate.getDate() - 1);
                if (countYesterday === 0) {
                    currentStreak = 0;
                }
            }
            
            if (countToday > 0 || countYesterday > 0) {
                while (true) {
                    let dStr = getLocalDateStr(checkDate);
                    let entry = history[dStr];
                    let count = typeof entry === 'number' ? entry : (entry?.count || 0);
                    if (count > 0) {
                        currentStreak++;
                        checkDate.setDate(checkDate.getDate() - 1);
                    } else {
                        break;
                    }
                }
            }
        }

        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        
        focusTotalEl.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        focusAvgEl.textContent   = totalSessions;
        focusPeakEl.textContent  = currentStreak;
    }

    function renderGithubCalendar(history, settings) {
        calendarEl.innerHTML = '';
        const customTooltip = document.getElementById('customTooltip');
        const today     = new Date();
        const WEEKS     = 13;
        const TOTAL     = WEEKS * 7;

        // Start from the Sunday before 90 days ago so columns are full weeks
        let startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (TOTAL - 1));
        startDate.setDate(startDate.getDate() - startDate.getDay()); // rewind to Sunday

        for (let i = 0; i < TOTAL; i++) {
            let cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);

            const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
            const entry    = history[dateStr];
            const count    = typeof entry === 'number' ? entry : (entry?.count || 0);
            const focusMinutes = typeof entry === 'number' ? (entry * (settings.focus || 25)) : (entry?.minutes || 0);
            const isFuture = cellDate > today;

            const cell = document.createElement('div');
            cell.classList.add('calendar-day');

            if (isFuture) {
                cell.style.opacity = '0.15';
            } else if (count === 0) {
                // Light slate default level-0 background
            } else if (count <= 2) {
                cell.classList.add('level-1');
            } else if (count <= 5) {
                cell.classList.add('level-2');
            } else if (count <= 8) {
                cell.classList.add('level-3');
            } else {
                cell.classList.add('level-4');
            }

            if (isFuture) {
                // No hover logic for future
            } else {
                const hours = Math.floor(focusMinutes / 60);
                const mins = focusMinutes % 60;
                const timeString = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                
                let formattedDate = dateStr;
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const year = parts[0];
                    const monthIndex = parseInt(parts[1], 10) - 1;
                    const day = parseInt(parts[2], 10);
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthName = months[monthIndex] || parts[1];
                    const dayStr = String(day).padStart(2, '0');
                    formattedDate = `${dayStr}-${monthName}-${year}`;
                }
                
                const tooltipText = `Date: [${formattedDate}]\nNo Sessions: ${count}\nFocused Time: ${timeString}`;
                
                cell.addEventListener('mouseenter', (e) => {
                    customTooltip.textContent = tooltipText;
                    customTooltip.classList.add('visible');
                    customTooltip.style.left = (e.clientX + 10) + 'px';
                    customTooltip.style.top = (e.clientY + 10) + 'px';
                });
                
                cell.addEventListener('mousemove', (e) => {
                    customTooltip.style.left = (e.clientX + 10) + 'px';
                    customTooltip.style.top = (e.clientY + 10) + 'px';
                });
                
                cell.addEventListener('mouseleave', () => {
                    customTooltip.classList.remove('visible');
                });
            }

            calendarEl.appendChild(cell);
        }
    }

    function renderFocusAreaAnalytics(sessions) {
        const progressBar = document.getElementById('bucketProgressBar');
        const legendList = document.getElementById('bucketLegendList');
        const tableBody = document.getElementById('historyTableBody');

        progressBar.innerHTML = '';
        legendList.innerHTML = '';
        tableBody.innerHTML = '';

        if (!sessions || sessions.length === 0) {
            progressBar.innerHTML = `<div class="no-distribution">No focus data logged yet. Complete focus sessions to see stats.</div>`;
            legendList.innerHTML = '';
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">No focus history yet.</td></tr>`;
            return;
        }

        // Group sessions by bucketId/bucketName
        const bucketTimes = {};
        let totalMinutes = 0;

        sessions.forEach(session => {
            const bId = session.bucketId || 'unassigned';
            const bName = session.bucketName || 'Unassigned';
            const mins = session.minutes || 0;

            if (!bucketTimes[bId]) {
                bucketTimes[bId] = {
                    name: bName,
                    minutes: 0
                };
            }
            bucketTimes[bId].minutes += mins;
            totalMinutes += mins;
        });

        // Curated vivid color palette for buckets
        const colors = [
            '#f97316', // Orange
            '#3b82f6', // Blue
            '#10b981', // Emerald
            '#8b5cf6', // Violet
            '#ec4899', // Pink
            '#06b6d4', // Cyan
            '#eab308'  // Yellow
        ];
        
        let colorIdx = 0;
        const bucketList = Object.keys(bucketTimes).map(bId => {
            const item = bucketTimes[bId];
            item.id = bId;
            item.percentage = totalMinutes > 0 ? Math.round((item.minutes / totalMinutes) * 100) : 0;
            
            if (bId === 'unassigned') {
                item.color = '#64748b'; // Slate grey for unassigned
            } else {
                item.color = colors[colorIdx % colors.length];
                colorIdx++;
            }
            return item;
        }).sort((a, b) => b.minutes - a.minutes);

        // Render Stacked Progress Bar
        bucketList.forEach(bucket => {
            if (bucket.percentage > 0) {
                const segment = document.createElement('div');
                segment.className = 'progress-segment';
                segment.style.width = `${bucket.percentage}%`;
                segment.style.backgroundColor = bucket.color;
                segment.title = `${bucket.name}: ${bucket.minutes}m (${bucket.percentage}%)`;
                progressBar.appendChild(segment);
            }
        });

        // Render Legend List
        bucketList.forEach(bucket => {
            const hrs = Math.floor(bucket.minutes / 60);
            const mins = bucket.minutes % 60;
            const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

            const itemEl = document.createElement('div');
            itemEl.className = 'legend-item';
            itemEl.innerHTML = `
                <div class="legend-info">
                    <span class="legend-color-dot" style="background-color: ${bucket.color}"></span>
                    <span class="legend-name">${escapeHTML(bucket.name)}</span>
                </div>
                <div class="legend-stats">
                    <span class="legend-time">${timeStr}</span>
                    <span class="legend-percent">${bucket.percentage}%</span>
                </div>
            `;
            legendList.appendChild(itemEl);
        });

        // Render Recent Tasks Table (last 10 sessions, descending order)
        const sortedSessions = [...sessions].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 10);
        
        sortedSessions.forEach(session => {
            const tr = document.createElement('tr');
            
            let displayDate = session.date || '--';
            if (session.date && session.date.includes('-')) {
                const parts = session.date.split('-');
                if (parts.length === 3) {
                    const year = parts[0];
                    const monthIndex = parseInt(parts[1], 10) - 1;
                    const day = parseInt(parts[2], 10);
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthName = months[monthIndex] || parts[1];
                    const dayStr = String(day).padStart(2, '0');
                    displayDate = `${dayStr}-${monthName}-${year}`;
                }
            }

            const bucketColor = bucketList.find(b => b.id === session.bucketId)?.color || '#64748b';

            tr.innerHTML = `
                <td>${displayDate}</td>
                <td>
                    <span class="table-bucket-badge" style="background-color: ${bucketColor}12; color: ${bucketColor}; border: 1px solid ${bucketColor}25;">
                        ${escapeHTML(session.bucketName || 'Unassigned')}
                    </span>
                </td>
                <td class="task-cell" title="${escapeHTML(session.taskName || 'Quick Focus')}">${escapeHTML(session.taskName || 'Quick Focus')}</td>
                <td><strong>${session.minutes}m</strong></td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // ─── EYEGUARD ANALYTICS ───────────────────────────────────────────────────

    function initEyeGuardDashboard() {
        chrome.storage.local.get(['eyeGuardHistory'], (result) => {
            const history = result.eyeGuardHistory || [];
            renderEyeGuardStats(history);
        });
    }

    function renderEyeGuardStats(history) {
        let completed = 0;
        let skipped = 0;

        history.forEach(item => {
            if (item.status === 'completed') completed++;
            else if (item.status === 'skipped') skipped++;
        });

        const total = completed + skipped;
        const compliance = total > 0 ? Math.round((completed / total) * 100) : 0;

        document.getElementById('breaksCompleted').textContent = completed;
        document.getElementById('breaksSkipped').textContent = skipped;
        document.getElementById('complianceRate').textContent = `${compliance}%`;

        // Render Table (last 10 entries)
        const tableBody = document.getElementById('eyeguardTableBody');
        tableBody.innerHTML = '';

        if (history.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #64748b; padding: 20px;">No break history yet.</td></tr>`;
            return;
        }

        // Sort descending by timestamp
        const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

        sorted.forEach(item => {
            const tr = document.createElement('tr');
            
            let displayDate = item.date || '--';
            if (item.date && item.date.includes('-')) {
                const [y, m, d] = item.date.split('-');
                displayDate = `${d}/${m}/${y}`;
            }

            const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isCompleted = item.status === 'completed';
            const badgeColor = isCompleted ? '#10b981' : '#ef4444';
            const statusText = isCompleted ? 'Completed' : 'Skipped';

            tr.innerHTML = `
                <td>${displayDate}</td>
                <td>${time}</td>
                <td>
                    <span class="table-bucket-badge" style="background-color: ${badgeColor}12; color: ${badgeColor}; border: 1px solid ${badgeColor}25;">
                        ${statusText}
                    </span>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // ─── PRAYER ANALYTICS ───────────────────────────────────────────────────

    let currentPrayerMonthDate = new Date();
    const prayerColors = ['#ef4444', '#0ea5e9', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#14b8a6'];

    function initPrayerDashboard() {
        chrome.storage.local.get(['prayers', 'prayerHistory'], (result) => {
            const prayers = result.prayers || [];
            const history = result.prayerHistory || {};
            
            renderPrayerCalendarAdherence(prayers, history, currentPrayerMonthDate);
            
            const prevBtn = document.getElementById('prayerPrevMonth');
            const nextBtn = document.getElementById('prayerNextMonth');
            
            if (prevBtn) {
                prevBtn.onclick = () => {
                    currentPrayerMonthDate.setMonth(currentPrayerMonthDate.getMonth() - 1);
                    renderPrayerCalendarAdherence(prayers, history, currentPrayerMonthDate);
                };
            }
            if (nextBtn) {
                nextBtn.onclick = () => {
                    currentPrayerMonthDate.setMonth(currentPrayerMonthDate.getMonth() + 1);
                    renderPrayerCalendarAdherence(prayers, history, currentPrayerMonthDate);
                };
            }
        });
    }

    function renderPrayerCalendarAdherence(prayers, history, viewDate) {
        const gridContainer = document.getElementById('prayerMonthCalendar');
        if (!gridContainer) return;
        gridContainer.innerHTML = '';

        const monthDisplay = document.getElementById('prayerCurrentMonthDisplay');
        if (monthDisplay) {
            monthDisplay.textContent = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // JS getDay() is 0 for Sunday, 1 for Monday. Let's make Monday = 0, Sunday = 6
        let startDayOfWeek = firstDay.getDay() - 1;
        if (startDayOfWeek === -1) startDayOfWeek = 6;
        
        const daysInMonth = lastDay.getDate();
        
        // Headers
        const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        weekdays.forEach(dayName => {
            const header = document.createElement('div');
            header.className = 'calendar-day-header';
            header.textContent = dayName;
            gridContainer.appendChild(header);
        });
        
        const todayObj = new Date();
        const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

        // Stats tracking for the viewed month
        let totalEnabledCells = 0;
        let totalCompletedCells = 0;
        let todayCompletedCount = 0;
        let todayEnabledCount = 0;
        let perfectDaysCount = 0;
        
        // Color mapping for prayers
        const prayerColorMap = {};
        prayers.forEach((p, index) => {
            prayerColorMap[p.id] = prayerColors[index % prayerColors.length];
        });

        // Previous month padding
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = startDayOfWeek - 1; i >= 0; i--) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day-cell other-month';
            
            const dateNum = document.createElement('div');
            dateNum.className = 'calendar-date-number';
            dateNum.textContent = prevMonthLastDay - i;
            cell.appendChild(dateNum);
            
            gridContainer.appendChild(cell);
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            const cell = document.createElement('div');
            cell.className = 'calendar-day-cell';
            if (dateStr === todayStr) {
                cell.classList.add('today');
            }
            
            const dateNum = document.createElement('div');
            dateNum.className = 'calendar-date-number';
            dateNum.textContent = i;
            cell.appendChild(dateNum);
            
            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'calendar-dots-container';
            
            const dayHistory = history[dateStr] || [];
            let dayCompletedCount = 0;
            let dayEnabledCount = 0;

            prayers.forEach(prayer => {
                if (prayer.enabled) {
                    dayEnabledCount++;
                    totalEnabledCells++;
                    const isCompleted = dayHistory.includes(prayer.id);
                    if (isCompleted) {
                        dayCompletedCount++;
                        totalCompletedCells++;
                    }
                    if (dateStr === todayStr) {
                        todayEnabledCount++;
                        if (isCompleted) todayCompletedCount++;
                    }
                    
                    // Render dot
                    const dot = document.createElement('div');
                    dot.className = 'prayer-dot';
                    dot.style.backgroundColor = isCompleted ? prayerColorMap[prayer.id] : '#e2e8f0';
                    dot.title = `${prayer.name}: ${isCompleted ? 'Completed' : 'Missed'}`;
                    dotsContainer.appendChild(dot);
                }
            });

            if (dayEnabledCount > 0 && dayCompletedCount === dayEnabledCount) {
                perfectDaysCount++;
            }
            
            cell.appendChild(dotsContainer);
            gridContainer.appendChild(cell);
        }
        
        // Next month padding
        const totalCellsRendered = startDayOfWeek + daysInMonth;
        const nextMonthDays = (7 - (totalCellsRendered % 7)) % 7;
        for (let i = 1; i <= nextMonthDays; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-day-cell other-month';
            
            const dateNum = document.createElement('div');
            dateNum.className = 'calendar-date-number';
            dateNum.textContent = i;
            cell.appendChild(dateNum);
            
            gridContainer.appendChild(cell);
        }
        
        // Render Stats Cards
        const ptc = document.getElementById('prayerTodayCount');
        if (ptc) ptc.textContent = `${todayCompletedCount} / ${todayEnabledCount}`;
        
        const complianceRate = totalEnabledCells > 0 ? Math.round((totalCompletedCells / totalEnabledCells) * 100) : 0;
        const pwr = document.getElementById('prayerWeeklyRate');
        if (pwr) {
            pwr.textContent = `${complianceRate}%`;
            pwr.nextElementSibling.textContent = `monthly compliance`;
        }
        
        const ppd = document.getElementById('prayerPerfectDays');
        if (ppd) {
            ppd.textContent = perfectDaysCount;
            ppd.nextElementSibling.textContent = `this month`;
        }
    }

    // ─── TAB SWITCHER ─────────────────────────────────────────────────────────

    document.querySelectorAll('.a-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.a-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.getAttribute('data-target');
            document.querySelectorAll('.a-tab-content').forEach(c => {
                c.style.display = (c.id === target) ? 'block' : 'none';
            });

            // Lazy-load/Re-render dashboard components
            if (target === 'hydration-analytics') initDashboard();
            else if (target === 'focus-analytics') initFocusDashboard();
            else if (target === 'eyeguard-analytics') initEyeGuardDashboard();
            else if (target === 'prayer-analytics') initPrayerDashboard();
        });
    });

    // ─── REAL-TIME STORAGE LISTENERS ──────────────────────────────────────────

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            if (changes.hydrationHistory) initDashboard();
            if (changes.focusHistory || changes.focusHistorySessions) initFocusDashboard();
            if (changes.eyeGuardHistory) initEyeGuardDashboard();
            if (changes.prayers || changes.prayerHistory) initPrayerDashboard();
        }
    });
});
