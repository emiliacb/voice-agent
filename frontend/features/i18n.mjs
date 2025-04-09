import appState from './state.mjs';

// Constants
export const AVAILABLE_LANGUAGES = ["en", "es"];

// Wordings for different languages
export const WORDINGS = {
    en: {
        title: "Voice Agent",
        hold: "Hold to Talk",
        recording: "Recording...",
        sending: "Thinking...",
        play: "Play response",
        errorMessage: "We recommend using Google Chrome for the best experience.",
    },
    es: {
        title: "Agente de voz",
        hold: "Pulsar para hablar",
        recording: "Grabando...",
        sending: "Pensando...",
        play: "Reproducir respuesta",
        errorMessage: "We recommend using Google Chrome for the best experience.",
    },
};

// Default language
let currentLanguage = "en";

/**
 * Set up language based on URL parameters or browser language
 */
export function setUpLanguageSelector() {
    const { langSelector, pttButton, errorMessage, playButton } = appState.domElements;
    
    const queryParams = new URLSearchParams(window.location.search);
    const selectedLanguage = queryParams.get("lang");
    const navigatorLanguage = navigator.language.split("-")[0];
    const preferedLanguage = selectedLanguage || navigatorLanguage;

    if (AVAILABLE_LANGUAGES.includes(preferedLanguage)) {
        currentLanguage = preferedLanguage;
    }

    const i18n = WORDINGS[currentLanguage];
    
    // Update DOM with selected language
    document.title = i18n.title;
    document.documentElement.setAttribute("lang", currentLanguage);
    appState.state.currentLanguage = currentLanguage;
    pttButton.textContent = i18n.hold;
    errorMessage.innerHTML = i18n.errorMessage;
    playButton.textContent = i18n.play;

    const isChrome = navigator.userAgent.includes("Chrome");
    if (!isChrome) {
        errorMessage.style.display = "block";
    }
    
    langSelector.textContent = currentLanguage === "es" ? "English" : "Español";
    langSelector.setAttribute(
        "href",
        `/?lang=${currentLanguage === "es" ? "en" : "es"}`
    );
    
    // Update i18n in appState
    appState.setDomElements({ i18n });
    
    return i18n;
} 