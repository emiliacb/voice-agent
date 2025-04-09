/** Config */
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
const IDLE_SHAPE_ID = "X";
const AVAILABLE_LANGUAGES = ["en", "es"];
const AUDIO_BIT_RATE = 16000;
const RECORDER_TIME_SLICE = 100;
const MAX_RECORDING_DURATION = 10000;

/** Web Worker */
const audioWorker = new Worker(new URL("./audio-worker.mjs", import.meta.url), {
    type: "module",
});

/** DOM Elements */
let audio, pttButton, mouthElement, langSelector, errorMessage;

// Pre-initialized stream and recorder
let audioStream = null;
let mediaRecorder = null;

/** I18n */
const WORDINGS = {
    en: {
        title: "Voice Agent",
        hold: "Hold to Talk",
        recording: "Recording...",
        sending: "Thinking...",
        interrupt: "Press to interrupt",
    },
    es: {
        title: "Agente de voz",
        hold: "Pulsar para hablar",
        recording: "Grabando...",
        sending: "Pensando...",
        interrupt: "Pulsar para interrumpir",
    },
};
let i18n = WORDINGS.en;

/** State */
const state = new Proxy(
    {
        animation: [],
        currentCue: IDLE_SHAPE_ID,
        previousCue: IDLE_SHAPE_ID,
        isPlaying: false,
        isRecording: false,
        isLoading: false,
        mediaRecorder: null,
        audioChunks: [],
        timeoutId: null,
    },
    {
        set(target, prop, value) {
            try {
                target[prop] = value;

                switch (prop) {
                    case "currentCue":
                        if (target.previousCue) {
                            mouthElement.classList.remove(`cue_${target.previousCue}`);
                        }
                        if (target.currentCue) {
                            mouthElement.classList.add(`cue_${target.currentCue}`);
                        }
                        break;

                    case "isRecording":
                        pttButton.classList.toggle("recording", value);
                        pttButton.textContent = value ? i18n.recording : i18n.hold;
                        pttButton.disabled = false;
                        break;

                    case "isLoading":
                        if (value) {
                            pttButton.classList.remove("recording");
                            pttButton.textContent = i18n.sending;
                            pttButton.disabled = value;
                        }
                        break;

                    case "isPlaying":
                        if (value) {
                            pttButton.textContent = i18n.interrupt;
                            pttButton.disabled = value;
                        }
                        break;
                }

                return true;
            } catch (error) {
                console.error("Error setting state:", error);
                return false;
            }
        },
    }
);

function stopAnimation() {
    state.isPlaying = false;
    mouthElement.classList.remove(`cue_${state.previousCue}`);
    mouthElement.classList.remove(`cue_${state.currentCue}`);
    mouthElement.classList.add(`cue_${IDLE_SHAPE_ID}`);
    state.previousCue = IDLE_SHAPE_ID;
    state.currentCue = IDLE_SHAPE_ID;
}

function animateShapes() {
    if (!state.isPlaying) return;

    const currentTime = audio.currentTime + 0.15;

    if (currentTime >= audio.duration) {
        stopAnimation();
        return;
    }

    const activeCue = state.animation.find(
        (cue) => currentTime >= cue.start && currentTime < cue.end
    );

    state.previousCue = state.currentCue;
    state.currentCue = activeCue?.value || state.previousCue;

    requestAnimationFrame(animateShapes);
}

async function sendAudioToServer() {
    try {
        state.isLoading = true;

        // Create a promise that will resolve when the worker sends back the result
        const workerResponse = new Promise((resolve, reject) => {
            audioWorker.onmessage = (e) => {
                const { type, data, error } = e.data;
                if (type === "AUDIO_PROCESSED") {
                    resolve(data);
                } else if (type === "ERROR") {
                    console.error("Error processing audio:", error);
                    reject(new Error(error));
                }
            };
        });

        // Send audio chunks to worker
        audioWorker.postMessage({
            type: "SEND_AUDIO",
            data: {
                audioChunks: state.audioChunks,
                backendUrl: BACKEND_BASE_URL,
            },
        });

        const result = await workerResponse;

        if (result.mouthCues) {
            state.animation = result.mouthCues;
            const audioUrl = URL.createObjectURL(result.responseAudioBlob);
            audio.src = audioUrl;
            state.isPlaying = true;
            audio.play();
            animateShapes();
        }

        state.isLoading = false;
    } catch (error) {
        state.isLoading = false;
        console.error("Error processing audio:", error);
    }
}

async function initializeAudioCapture() {
    try {
        if (typeof MediaRecorder === "undefined") {
        }

        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: AUDIO_BIT_RATE,
            },
        });
        mediaRecorder = new MediaRecorder(audioStream, {
            mimeType: "audio/webm;codecs=opus",
            audioBitsPerSecond: AUDIO_BIT_RATE,
        });

        audioStream.getTracks().forEach((track) => (track.enabled = false));
    } catch (error) {
        console.error("Error initializing audio capture:", error);
    }
}

async function startRecording() {
    if (state.isRecording || state.isLoading) return;

    if (state.isPlaying) {
        stopAnimation();
        audio.pause();
    }

    try {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            await initializeAudioCapture();
        }

        state.audioChunks = [];
        audioStream.getTracks().forEach((track) => (track.enabled = true));

        mediaRecorder.ondataavailable = ({ data }) =>
            data.size > 0 && state.audioChunks.push(data);

        mediaRecorder.start(RECORDER_TIME_SLICE);
        state.isRecording = true;
        state.timeoutId = setTimeout(stopRecording, MAX_RECORDING_DURATION);
    } catch (error) {
        console.error("Recording failed:", error);
        state.isRecording = false;
    }
}

async function stopRecording() {
    if (!state.isRecording) return;

    return new Promise((resolve) => {
        mediaRecorder.onstop = async () => {
            // Clear the timeout if recording stopped manually
            clearTimeout(state.timeoutId);
            await sendAudioToServer();

            // Disable the tracks to save resources
            audioStream.getTracks().forEach((track) => (track.enabled = false));
            state.isRecording = false;
            resolve();
        };

        mediaRecorder.stop();
    });
}

function setupPushToTalk() {
    pttButton.addEventListener("mousedown", startRecording);
    pttButton.addEventListener("mouseup", stopRecording);
    pttButton.addEventListener("mouseleave", stopRecording);
    pttButton.addEventListener("touchstart", startRecording);
    pttButton.addEventListener("touchend", stopRecording);
    pttButton.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            startRecording();
        }
    });
    pttButton.addEventListener("keyup", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            stopRecording();
        }
    });
}

function setUpLanguageSelector() {
    const queryParams = new URLSearchParams(window.location.search);
    const selectedLanguage = queryParams.get("lang");
    const navigatorLanguage = navigator.language.split("-")[0];
    const preferedLanguage = selectedLanguage || navigatorLanguage;

    if (AVAILABLE_LANGUAGES.includes(preferedLanguage)) {
        i18n = WORDINGS[preferedLanguage];
    }

    document.title = i18n.title;
    document.documentElement.setAttribute("lang", preferedLanguage);
    pttButton.textContent = i18n.hold;
    langSelector.textContent = preferedLanguage === "es" ? "English" : "Español";
    langSelector.setAttribute(
        "href",
        `/?lang=${preferedLanguage === "es" ? "en" : "es"}`
    );
}

function initialize() {
    audio = document.getElementById("audio");
    pttButton = document.getElementById("pttButton");
    langSelector = document.getElementById("lang-selector");
    mouthElement = document.querySelector(".mouth");
    errorMessage = document.getElementById("error-message");

    setupPushToTalk();
    setUpLanguageSelector();
}

async function main() {
    initialize();
    audio.addEventListener("ended", () => {
        setTimeout(() => {
            stopAnimation();
        }, 500);
    });
}

document.addEventListener("DOMContentLoaded", main);
