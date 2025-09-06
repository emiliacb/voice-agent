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
        disclaimer: "We recommend using Google Chrome for the best experience using this demo.",
        individualRateLimit: "You have reached your individual limit of 10 requests per hour.",
        collectiveRateLimit: "We are getting too much messages, please try again later.",
        wakingUp: "Waking up service. Please wait a minute...",
        genericError: "An unexpected error occurred. Please try again."
    },
    es: {
        title: "Agente de voz",
        hold: "Mantené presionado para hablar",
        recording: "Grabando...",
        sending: "Pensando...",
        play: "Reproducir respuesta",
        disclaimer: "Recomendamos usar Google Chrome para una mejor experiencia usando esta demo.",
        individualRateLimit: "Alcanzaste tu límite individual de 10 solicitudes por hora.",
        collectiveRateLimit: "Estamos recibiendo demasiados mensajes, por favor intentá de nuevo más tarde.",
        wakingUp: "Levantando el servidor. Por favor espere un minuto...",
        genericError: "Ocurrió un error inesperado. Por favor, intentá de nuevo."
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
    pttButton.classList.add(`lang_${currentLanguage}`);
    pttButton.classList.add("idle");
    errorMessage.textContent = i18n.errorMessage;
    playButton.textContent = i18n.play;
    
    langSelector.textContent = currentLanguage === "es" ? "English" : "Español";
    langSelector.setAttribute(
        "href",
        `/?lang=${currentLanguage === "es" ? "en" : "es"}`
    );
    
    // Update i18n in appState
    appState.setDomElements({ i18n });
    
    return i18n;
} 