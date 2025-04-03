/** Config */
const audioSrc = '/audios/audio-3.wav';
const animationJson = '/audios/audio-3.json';

/** DOM Elements */
const audio = document.getElementById('audio');
const startButton = document.getElementById('start');

/** State */
const state = new Proxy({
    animation: [],
    currentCue: null,
    previousCue: null,
    isPlaying: false,
    mouthElement: null,
}, {
    set(target, prop, value) {
        target[prop] = value;

        if (prop === 'isPlaying') {
            // Update start button text
            startButton.textContent = target.isPlaying ? 'Pause' : 'Start';
        }

        if (prop === 'currentCue' && target.mouthElement) {
            // Remove previous cue class
            if (target.previousCue) {
                target.mouthElement.classList.remove(`cue_${target.previousCue}`);
            }
            
            // Idle class
            if (!target.currentCue) {
                target.mouthElement.classList.add('cue_X');
            }

            // New cue class
            if (target.currentCue) {
                target.mouthElement.classList.add(`cue_${target.currentCue}`);
            }
        }
    }
});

function initializeMouth() {
    state.mouthElement = document.querySelector('.mouth');
    if (!state.mouthElement) {
        throw new Error('Mouth element not found');
    }
}

async function getAnimation() {
    const response = await fetch(animationJson);
    const data = await response.json();
    const cues = data?.mouthCues;

    const cuesWithTime = cues.filter(cue => cue.end - cue.start > 0.02);
    return cuesWithTime;
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

async function main() {
    initializeMouth();

    audio.src = audioSrc;
    state.animation = await getAnimation();

    if (state.animation.length) {
        startButton.disabled = false;
    }

    startButton.addEventListener('click', () => {
        if (state.isPlaying) {
            audio.pause();
            stopAnimation();
            return;
        }

        audio.play();
        state.isPlaying = true;
        animateShapes();
    });

    audio.addEventListener('ended', () => {
        stopAnimation();
    });
}

main();
