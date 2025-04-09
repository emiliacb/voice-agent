import appState from './features/state.mjs';
import { setupAnimationListeners } from './features/animation.mjs';
import { setupPushToTalk, initializeAudioCapture } from './features/recording.mjs';
import { setUpLanguageSelector } from './features/i18n.mjs';

// Initialize DOM elements
function initialize() {
    const audio = document.getElementById("audio");
    const pttButton = document.getElementById("pttButton");
    const playButton = document.getElementById("playButton");
    const langSelector = document.getElementById("langSelector");
    const mouthElement = document.querySelector(".mouth");
    const errorMessage = document.getElementById("errorMessage");

    // Set DOM elements in state
    appState.setDomElements({
        audio,
        pttButton,
        playButton,
        langSelector,
        mouthElement,
        errorMessage,
    });
    
    setUpLanguageSelector();
    
    // Setup listeners
    setupPushToTalk();
    setupAnimationListeners();
}

async function main() {
    initialize();
    await initializeAudioCapture();
}

// Entry point
document.addEventListener("DOMContentLoaded", main); 