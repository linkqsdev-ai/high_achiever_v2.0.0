chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const audio = document.getElementById('audioPlayer');
    if (!audio) {
        sendResponse({ status: 'error', error: 'Audio element not found' });
        return false;
    }

    if (!audio.onended) {
        audio.onended = () => {
            chrome.runtime.sendMessage({
                type: 'audio-ended'
            }).catch(e => console.error("Error sending audio-ended:", e));
        };
    }

    if (message.target === 'offscreen') {
        if (message.type === 'play-audio') {
            audio.src = message.url;
            audio.volume = message.volume !== undefined ? message.volume : 0.8;
            audio.loop = message.loop === true;
            audio.play()
                .then(() => {
                    console.log("Adhan audio started playing successfully.");
                    sendResponse({ status: 'playing' });
                })
                .catch((err) => {
                    console.error("Failed to play Adhan audio:", err);
                    sendResponse({ status: 'error', error: err.message });
                });
            return true; // async response
        } else if (message.type === 'stop-audio') {
            audio.pause();
            audio.currentTime = 0;
            sendResponse({ status: 'stopped' });
            return true;
        }
    }
});
