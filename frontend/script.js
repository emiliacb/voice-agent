/** Config */
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;

/** DOM Elements */
let audio, startButton, audioFileInput, mouthElement;

/** State */
const state = new Proxy({
    animation: [],
    currentCue: 'X',
    previousCue: 'X',
    isPlaying: false,
    audioFile: null
}, {
    set(target, prop, value) {
        try {
            target[prop] = value;

            if (prop === 'audioFile') {
                startButton.disabled = !value;
            }

            if (prop === 'isPlaying') {
                // Update start button text
                startButton.textContent = target.isPlaying ? 'Pause' : 'Start';
            }

            if (prop === 'currentCue' && mouthElement) {
                // Remove previous cue class
                if (target.previousCue) {
                    mouthElement.classList.remove(`cue_${target.previousCue}`);
                }
                
                // Idle class
                if (!target.currentCue) {
                    mouthElement.classList.add('cue_X');
                }

                // New cue class
                if (target.currentCue) {
                        mouthElement.classList.add(`cue_${target.currentCue}`);
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error setting state:', error);
            return false;
        }
    }
});

function initialize() {
    audio = document.getElementById('audio');
    startButton = document.getElementById('start');
    audioFileInput = document.getElementById('audioFile');
    mouthElement = document.querySelector('.mouth');
}

async function processAudioFile(file) {
    try {
        const formData = new FormData();
        formData.append('audio', file);

        const response = await fetch(`${BACKEND_BASE_URL}/api/lipsync`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Failed to process audio: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const cues = data?.mouthCues;

        if (!cues) {
            throw new Error('Invalid response format');
        }

        return cues.filter(cue => cue.end - cue.start > 0.02);
    } catch (error) {
        console.error('Error processing audio:', error);
        alert('Failed to process audio file. Please try again. Error: ' + error.message);
        return [];
    }
}

function animateShapes() {
    if (!state.isPlaying) return;

    const currentTime = audio.currentTime + 0.15;

    if (currentTime >= audio.duration) {
        stopAnimation();
        return;
    }

    const activeCue = state.animation.find(cue => 
        currentTime >= cue.start && 
        currentTime < cue.end
    );

    state.previousCue = state.currentCue;
    state.currentCue = activeCue?.value || state.previousCue;

    requestAnimationFrame(animateShapes);
}

function stopAnimation() {
    state.isPlaying = false;
    
    // Reset to idle position
    state.previousCue = null;
    state.currentCue = null;
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Create object URL for audio playback
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    state.audioFile = file;
}

async function handleStart() {
    if (state.isPlaying) {
        audio.pause();
        stopAnimation();
        return;
    }

    if (!state.animation.length) {
        startButton.disabled = true;
        state.animation = await processAudioFile(state.audioFile);
        startButton.disabled = false;
        
        if (!state.animation.length) {
            return;
        }
    }

    audio.play();
    state.isPlaying = true;
    animateShapes();
}

async function main() {
    initialize();

    // Event listeners
    audioFileInput.addEventListener('change', handleFileSelect);
    startButton.addEventListener('click', handleStart);
    audio.addEventListener('ended', stopAnimation);
}

document.addEventListener('DOMContentLoaded', main);
