import appState from './state.mjs';
import { animateShapes, stopAnimation } from './animation.mjs';
import { getRecordType } from '../utils/get-record-type.mjs';
import { playIfSupported } from '../utils/get-play-permissions.mjs';

// Constants
export const AUDIO_BIT_RATE = 16000;
export const RECORDER_TIME_SLICE = 100;
export const MAX_RECORDING_DURATION = 10000;

// Web Worker for audio processing
const audioWorker = new Worker(new URL("./audio-worker.mjs", import.meta.url), {
    type: "module",
});

// Pre-initialized stream and recorder
let audioStream = null;
let mediaRecorder = null;

export async function initializeAudioCapture() {
    try {
        if (typeof MediaRecorder === "undefined") {
            throw new Error("MediaRecorder is not supported in this browser");
        }

        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: AUDIO_BIT_RATE,
            },
        });

        mediaRecorder = new MediaRecorder(audioStream, {
            mimeType: getRecordType(),
            audioBitsPerSecond: AUDIO_BIT_RATE,
        });

        audioStream.getTracks().forEach((track) => (track.enabled = false));
    } catch (error) {
        console.error("Error initializing audio capture:", error);
    }
}

export async function startRecording() {
    if (appState.state.isRecording || appState.state.isLoading) return;

    if (appState.state.isPlaying) {
        stopAnimation();
        appState.domElements.audio.pause();
    }

    try {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            await initializeAudioCapture();
        }

        appState.state.audioChunks = [];
        audioStream.getTracks().forEach((track) => (track.enabled = true));

        mediaRecorder.ondataavailable = ({ data }) =>
            data.size > 0 && appState.state.audioChunks.push(data);

        mediaRecorder.start(RECORDER_TIME_SLICE);
        appState.state.isRecording = true;
        appState.state.timeoutId = setTimeout(stopRecording, MAX_RECORDING_DURATION);
    } catch (error) {
        console.error("Recording failed:", error);
        appState.state.isRecording = false;
    }
}

export async function stopRecording() {
    if (!appState.state.isRecording) return;

    return new Promise((resolve) => {
        mediaRecorder.onstop = async () => {
            // Clear the timeout if recording stopped manually
            clearTimeout(appState.state.timeoutId);
            await sendAudioToServer();

            // Disable the tracks to save resources
            audioStream.getTracks().forEach((track) => (track.enabled = false));
            appState.state.isRecording = false;
            resolve();
        };

        mediaRecorder.stop();
    });
}

export async function sendAudioToServer() {
    try {
        appState.state.isLoading = true;
        const { audio } = appState.domElements;
        const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;

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
                audioChunks: appState.state.audioChunks,
                backendUrl: BACKEND_BASE_URL,
                currentLanguage: appState.state.currentLanguage,
            },
        });

        const result = await workerResponse;

        if (result.mouthCues) {
            appState.state.animation = result.mouthCues;
            const audioUrl = URL.createObjectURL(result.responseAudioBlob);
            audio.src = audioUrl;
            playAudio();
        }

        appState.state.isLoading = false;
    } catch (error) {
        appState.state.isLoading = false;
        console.error("Error processing audio:", error);
    }
}

export function playAudio() {
    const { audio, playButton } = appState.domElements;
    const { ok } = playIfSupported(audio);

    if (!ok) {
        playButton.style.display = "block";
        playButton.onclick = () => {
            playButton.style.display = "none";
            audio.load();
            audio.play();
            appState.state.isPlaying = true;
            animateShapes();
        };

        return;
    }

    appState.state.isPlaying = true;
    animateShapes();
}

export function setupPushToTalk() {
    const { pttButton } = appState.domElements;
    
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