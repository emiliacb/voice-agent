import appState from './state.mjs';
import { IDLE_SHAPE_ID } from './state.mjs';

export function stopAnimation() {
    appState.state.isPlaying = false;
    const { mouthElement } = appState.domElements;
    
    mouthElement.classList.remove(`cue_${appState.state.previousCue}`);
    mouthElement.classList.remove(`cue_${appState.state.currentCue}`);
    mouthElement.classList.add(`cue_${IDLE_SHAPE_ID}`);
    appState.state.previousCue = IDLE_SHAPE_ID;
    appState.state.currentCue = IDLE_SHAPE_ID;
}

export function animateShapes() {
    if (!appState.state.isPlaying) return;

    const { audio } = appState.domElements;
    const currentTime = audio.currentTime + 0.15;

    if (currentTime >= audio.duration) {
        stopAnimation();
        return;
    }

    const activeCue = appState.state.animation.find(
        (cue) => currentTime >= cue.start && currentTime < cue.end
    );

    appState.state.previousCue = appState.state.currentCue;
    appState.state.currentCue = activeCue?.value || appState.state.previousCue;

    requestAnimationFrame(animateShapes);
}

export function setupAnimationListeners() {
    const { audio } = appState.domElements;
    
    audio.addEventListener("ended", () => {
        setTimeout(() => {
            stopAnimation();
        }, 500);
    });
} 