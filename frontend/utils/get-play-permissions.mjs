// Safari does not support the .play method on the audio element
export function isSafari() {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// Brave does not support the .play method on the audio element, due to privacy reasons
export function isBrave() {
    return navigator.userAgent.includes("Brave");
}

export function isInAppBrowser() {
    // Check for common in-app browser indicators
    const ua = navigator.userAgent;
    
    // Standard patterns for other in-app browsers
    if (/instagram|fbav|fban|twitter|wechat|weibo|line|miui/i.test(ua)) return true;
    
    // Check for iOS in-app browser
    if (/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua)) return true;
    
    // Check for Android in-app browser
    if (/Android.*wv/i.test(ua)) return true;
    
    return false;
}

// Check if the browser supports the .play method on the audio element
export function playIfSupported(audioElement) {
    try {
        if (isSafari() || isInAppBrowser() || isBrave()) {
            throw new Error("Current browser does not support the .play method on the audio element");
        }
        audioElement.load();
        audioElement.play();
        return { ok: true };
    } catch (error) {
        return { ok: false, error };
    }
}
