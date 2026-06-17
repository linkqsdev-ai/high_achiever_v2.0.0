# High Achiever (LinKQ Product)
*(Formerly FocusFlow)*

**High Achiever** is a premium ADHD-friendly productivity and wellness Chrome extension by LinKQ, designed to help you lock in, stay hydrated, and protect your eyes during long coding or work sessions.

**Version:** 1.0.0 (Released 03/06/2026)

---

## 🚀 How to Install for Testing

Since this extension is currently in beta and not yet published on the Chrome Web Store, you will need to install it manually using "Developer mode".

1. **Unzip the file:** Extract the `FocusFlow_v1.2.0.zip` file to a folder on your computer.
2. **Open Chrome Extensions:** Open Google Chrome and type `chrome://extensions/` in the URL bar, then hit Enter.
3. **Enable Developer Mode:** In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.
4. **Load Unpacked:** Click the **Load unpacked** button that appears in the top-left corner.
5. **Select the Folder:** Browse to the folder where you extracted the zip file (the folder containing the `manifest.json` file) and select it.
6. **Pin the Extension:** Click the puzzle piece icon 🧩 in your Chrome toolbar and click the "Pin" icon next to **High Achiever** to keep it visible.

---

## 🛠 Features to Test

Please test the following core features and provide your feedback:

### 1. 🎯 Focus Mode (Auto-Resuming Timer)
- **What it is:** A Pomodoro-style timer that automatically cycles through your Focus sessions, Short Breaks, and Long Breaks.
- **How to test:** 
  - Open the extension popup, switch to the "Focus" tab.
  - Set custom durations (e.g., 1 min focus, 1 min break for quick testing).
  - Click **Start Session**.
  - Wait for the timer to end. You should receive a native Windows notification, and the timer will *automatically resume* into the next break/focus session without you needing to click anything.

### 2. 📊 Advanced Analytics Dashboard
- **What it is:** A GitHub-style 90-day activity calendar tracking your hydration and focus habits.
- **How to test:** 
  - Click the **View Analytics** button in the popup.
  - On the **Focus Mode** tab, hover your mouse over the colored squares in the calendar.
  - You should instantly see a custom hover tooltip detailing the Date, Number of Sessions, and exact Total Focused Time (e.g., `1h 30m`).

### 3. 💧 Hydration Tracker
- **What it is:** A water intake logger with configurable reminder intervals.
- **How to test:** 
  - In the popup, enable "Water Reminders" and set it to 30 mins. 
  - Click the **+1 Glass** button.
  - Open Analytics to see your daily and weekly hydration stats instantly update.

### 4. 🕌 Prayer Times and Smart Alerts
- **What it is:** A prayer scheduler that alerts you exactly 7 minutes before the prayer, plays an Adhan sound, sorts upcoming prayers today chronologically, and grays out completed prayers.
- **How to test:**
  - Add a prayer time 8 minutes from now.
  - Wait 1 minute. Verify the row glows pink/red indicating alarm status, and you receive an Adhan audio notification.
  - Set some prayer times in the past and some in the future. Verify upcoming prayers are sorted at the top, and passed prayers are grayed out at the bottom.

---

## 🐛 Feedback Request
If you encounter any glitches, or have suggestions for UI/UX improvements, please let us know! Specifically looking for feedback on:
- Does the Google Sign-in flow and account chooser simulation feel intuitive?
- Do the optional task timers and color-coded bucket borders make scheduling easier?
- Are the chronological prayer sorting and alarm highlights working reliably?
- Do the native Windows notifications trigger reliably for you?
