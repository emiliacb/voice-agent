/** Config */
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
const IDLE_SHAPE_ID = "X";
const AVAILABLE_LANGUAGES = ["en", "es"];
const AUDIO_BIT_RATE = 12000;

/** DOM Elements */
let audio, pttButton, mouthElement;

/** I18n */
const WORDINGS = {
    en: {
        title: "Voice Agent",
        pttButton: "Hold to Talk",
        recording: "Recording...",
        sending: "Sending...",
    },
    es: {
        title: "Agente de voz",
        pttButton: "Pulsar para hablar",
        recording: "Grabando...",
        sending: "Enviando...",
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
                        pttButton.textContent = value ? i18n.recording : i18n.pttButton;
                        pttButton.disabled = false;
                        break;
                        
                    case "isLoading":
                        if (value) {
                            pttButton.classList.remove("recording");
                            pttButton.textContent = i18n.sending;
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

async function sendAudioToServer(audioBlob) {
    try {
        state.isLoading = true;

        const formData = new FormData();
        formData.append("audio", audioBlob);

        const response = await fetch(`${BACKEND_BASE_URL}/rhubarb`, {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const result = await response.json();
        
        if (result.mouthCues) {
            state.animation = result.mouthCues;
            const audioUrl = URL.createObjectURL(audioBlob);
            audio.src = audioUrl;
            audio.play();
            state.isPlaying = true;
            animateShapes();
        }

        state.isLoading = false;

    } catch (error) {
        state.isLoading = false;
        console.error("Error sending audio:", error);
    }
}

async function startRecording() {
    if (state.isRecording || state.isLoading) return;

    if (state.isPlaying) {
        stopAnimation();
        audio.pause();
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.audioChunks = [];

        state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
            audioBitsPerSecond: AUDIO_BIT_RATE,
        });

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };

        state.mediaRecorder.start();
        state.isRecording = true;
    } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Could not access microphone");
    }
}

async function stopRecording() {
    if (!state.isRecording) return;

    return new Promise((resolve) => {
        state.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(state.audioChunks, {
                type: "audio/webm;codecs=opus",
            });
            await sendAudioToServer(audioBlob);

            // Cleanup
            state.mediaRecorder.stream.getTracks().forEach((track) => track.stop());
            state.isRecording = false;
            resolve();
        };

        state.mediaRecorder.stop();
    });
}

function setupPushToTalk() {
    pttButton.addEventListener("mousedown", startRecording);
    pttButton.addEventListener("mouseup", stopRecording);
    pttButton.addEventListener("mouseleave", stopRecording);
    pttButton.addEventListener("touchstart", startRecording);
    pttButton.addEventListener("touchend", stopRecording);
}

function initialize() {
    audio = document.getElementById("audio");
    pttButton = document.getElementById("pttButton");
    mouthElement = document.querySelector(".mouth");
    setupPushToTalk();

    const queryParams = new URLSearchParams(window.location.search);
    const selectedLanguage = queryParams.get("lang");
    const navigatorLanguage = navigator.language.split("-")[0];
    const preferedLanguage = selectedLanguage || navigatorLanguage;

    if (AVAILABLE_LANGUAGES.includes(preferedLanguage)) {
        i18n = WORDINGS[preferedLanguage];
    }

    document.title = i18n.title;
    document.documentElement.setAttribute("lang", preferedLanguage);
    pttButton.textContent = i18n.pttButton;
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

function stopAnimation() {
    state.isPlaying = false;
    mouthElement.classList.remove(`cue_${state.previousCue}`);
    mouthElement.classList.remove(`cue_${state.currentCue}`);
    mouthElement.classList.add(`cue_${IDLE_SHAPE_ID}`);
    state.previousCue = IDLE_SHAPE_ID;
    state.currentCue = IDLE_SHAPE_ID;
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
