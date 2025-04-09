import appState from './features/state.mjs';
import { setupAnimationListeners } from './features/animation.mjs';
import { setupPushToTalk, initializeAudioCapture } from './features/recording.mjs';
import { setUpLanguageSelector } from './features/i18n.mjs';
import { setUpError, showError } from './utils/error.mjs';

// Initialize DOM elements
function initialize() {
    const audio = document.getElementById("audio");
    const pttButton = document.getElementById("pttButton");
    const playButton = document.getElementById("playButton");
    const langSelector = document.getElementById("langSelector");
    const mouthElement = document.querySelector(".mouth");
    const errorMessage = document.getElementById("errorMessage");
    const closeErrorMessage = document.getElementById("closeErrorMessage");

    // Set DOM elements in state
    appState.setDomElements({
        audio,
        pttButton,
        playButton,
        langSelector,
        mouthElement,
        errorMessage,
        closeErrorMessage,
    });
    
    // Setup listeners
    setUpError();
    setUpLanguageSelector();
    setupPushToTalk();
    setupAnimationListeners();

    // Show disclaimer if not Chrome
    const isChrome = navigator.userAgent.includes("Chrome");
    if (!isChrome) {
        showError(appState.domElements.i18n.disclaimer);
    }
}

async function main() {
    initialize();
    await initializeAudioCapture();
}

// Entry point
document.addEventListener("DOMContentLoaded", main); 