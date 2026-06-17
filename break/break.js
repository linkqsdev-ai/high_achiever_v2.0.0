// [[Node: EyeGuard_Logic]]
document.addEventListener('DOMContentLoaded', () => {
    let timeLeft = 20;
    const timerElement = document.getElementById('timer');
    const skipBtn = document.getElementById('skipBtn');

    const countdown = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(countdown);
            logBreakEvent('completed');
        }
    }, 1000);

    skipBtn.addEventListener('click', () => {
        clearInterval(countdown);
        logBreakEvent('skipped');
    });

    function logBreakEvent(status) {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        chrome.storage.local.get(['eyeGuardHistory'], (result) => {
            let history = result.eyeGuardHistory || [];
            history.push({
                id: 'eg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                date: today,
                timestamp: Date.now(),
                status: status
            });
            chrome.storage.local.set({ eyeGuardHistory: history }, () => {
                closeTab();
            });
        });
    }

    function closeTab() {
        // Only works if opened by script, which is true
        window.close();
    }
});
