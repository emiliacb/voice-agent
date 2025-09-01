import appState from '../features/state.mjs';

export function getDomElements() {
    // Initialize DOM elements
    const domElements = {
        audio: document.getElementById("audio"),
        pttButton: document.getElementById("pttButton"),
        playButton: document.getElementById("playButton"),
        langSelector: document.getElementById("langSelector"),
        mouthElement: document.querySelector(".mouth"),
        errorMessage: document.getElementById("errorMessage"),
        closeErrorMessage: document.getElementById("closeErrorMessage"),
    };

    // Set DOM elements in state
    appState.setDomElements(domElements);

    return domElements;
}
