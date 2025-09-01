import appState from './features/state.mjs';
import { setupAnimationListeners } from './features/animation.mjs';
import { setupPushToTalk, initializeAudioCapture } from './features/recording.mjs';
import { wakeUpBackend } from "./features/wake-up.mjs";
import { setUpLanguageSelector } from './features/i18n.mjs';
import { setUpError, showError } from './utils/error.mjs';
import { getDomElements } from './utils/get-dom-elements.mjs';

function initialize() {
    // Setup listeners
    getDomElements()
    setUpError();
    setUpLanguageSelector();
    setupAnimationListeners();
    setupPushToTalk();

    // Show disclaimer if not Chrome
    const isChrome = navigator.userAgent.includes("Chrome");
    if (!isChrome) {
        showError(appState.domElements.i18n.disclaimer);
    }
}

async function main() {
    initialize();
    await wakeUpBackend();
    await initializeAudioCapture();
}

// Entry point
document.addEventListener("DOMContentLoaded", main); 