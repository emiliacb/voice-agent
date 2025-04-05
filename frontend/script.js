/** Config */
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
const IDLE_SHAPE_ID = "X";

/** DOM Elements */
let audio, pttButton, mouthElement;

/** State */
const state = new Proxy(
    {
        animation: [],
        currentCue: IDLE_SHAPE_ID,
        previousCue: IDLE_SHAPE_ID,
        isPlaying: false,
        isRecording: false,
        mediaRecorder: null,
        audioChunks: [],
    },
    {
        set(target, prop, value) {
            try {
                target[prop] = value;

                if (prop === "isPlaying") {
                    if (!value) {
                        pttButton.disabled = false;
                    }
                }

                if (prop === "currentCue" && mouthElement) {
                    if (target.previousCue) {
                        mouthElement.classList.remove(`cue_${target.previousCue}`);
                    }
                    if (target.currentCue) {
                        mouthElement.classList.add(`cue_${target.currentCue}`);
                    }
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
        pttButton.disabled = true;
        pttButton.textContent = "Sending...";
        const formData = new FormData();
        formData.append("audio", audioBlob);

        const response = await fetch(`${BACKEND_BASE_URL}/rhubarb`, {
            method: "POST",
            body: formData,
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
    } catch (error) {
        console.error("Error sending audio:", error);
        pttButton.disabled = false;
    }
}

async function startRecording() {
    if (state.isRecording || state.isPlaying) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.audioChunks = [];

        state.mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
            audioBitsPerSecond: 32000,
        });

        state.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                state.audioChunks.push(event.data);
            }
        };

        state.mediaRecorder.start();
        state.isRecording = true;
        pttButton.classList.add("recording");
        pttButton.textContent = "Recording...";
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
            pttButton.classList.remove("recording");
            pttButton.textContent = "Hold to Talk";
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
