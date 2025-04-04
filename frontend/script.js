/** Config */
const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
const CHUNK_DURATION = 10; // Duration of each chunk in seconds

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

async function splitAudioIntoChunks(audioFile) {
    const audioContext = new AudioContext();
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const chunks = [];
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const chunkSamples = CHUNK_DURATION * sampleRate;
    
    for (let offset = 0; offset < audioBuffer.length; offset += chunkSamples) {
        const chunkLength = Math.min(chunkSamples, audioBuffer.length - offset);
        const chunkBuffer = new AudioBuffer({
            length: chunkLength,
            numberOfChannels,
            sampleRate
        });
        
        // Copy data for each channel
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            chunkBuffer.copyToChannel(
                channelData.slice(offset, offset + chunkLength),
                channel
            );
        }
        
        // Convert AudioBuffer to WAV Blob
        const wavBlob = await audioBufferToWav(chunkBuffer);
        chunks.push({
            blob: wavBlob,
            startTime: offset / sampleRate
        });
    }
    
    return chunks;
}

async function audioBufferToWav(audioBuffer) {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numberOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    
    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // Write audio data
    const offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = audioBuffer.getChannelData(channel)[i];
            const scaled = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
            view.setInt16(offset + (i * numberOfChannels + channel) * 2, scaled, true);
        }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

async function processAudioChunk(chunk, startTime) {
    try {
        const formData = new FormData();
        formData.append('audio', chunk.blob);

        const response = await fetch(`${BACKEND_BASE_URL}/lipsync`, {
            method: 'POST',
            body: formData,
            credentials: 'include',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server error:', errorText);
            throw new Error(`Failed to process audio chunk: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const cues = data?.mouthCues;

        if (!cues) {
            throw new Error('Invalid response format');
        }

        // Adjust timestamps based on chunk start time
        return cues
            .map(cue => ({
                ...cue,
                start: cue.start + startTime,
                end: cue.end + startTime
            }))
            .filter(cue => cue.end - cue.start > 0.02);
    } catch (error) {
        console.error('Error processing audio chunk:', error);
        throw error;
    }
}

async function processAudioFile(file) {
    try {
        const chunks = await splitAudioIntoChunks(file);
        console.log(`Split audio into ${chunks.length} chunks`);

        // Process chunks sequentially
        const allCues = [];
        let processedChunks = 0;
        
        for (const chunk of chunks) {
            try {
                const chunkCues = await processAudioChunk(chunk, chunk.startTime);
                allCues.push(...chunkCues);
                
                // Update progress
                processedChunks++;
                const progress = Math.round((processedChunks / chunks.length) * 100);
                console.log(`Processing progress: ${progress}%`);
                
            } catch (error) {
                console.error(`Error processing chunk at ${chunk.startTime}s:`, error);
                // Continue with next chunk even if this one failed
                continue;
            }
        }

        // Sort all cues by start time
        allCues.sort((a, b) => a.start - b.start);

        // Merge overlapping cues
        const mergedCues = [];
        for (const cue of allCues) {
            const lastCue = mergedCues[mergedCues.length - 1];
            if (lastCue && lastCue.end >= cue.start && lastCue.value === cue.value) {
                lastCue.end = Math.max(lastCue.end, cue.end);
            } else {
                mergedCues.push(cue);
            }
        }

        return mergedCues;
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
