// Constants
export const IDLE_SHAPE_ID = "X";

// State Singleton
class AppState {
    constructor() {
        this._state = new Proxy(
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
                streamingText: "",
                isStreaming: false,
            },
            {
                set(target, prop, value) {
                    try {
                        target[prop] = value;

                        const { mouthElement, pttButton, i18n, textDisplay } = AppState.instance.domElements;

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
                                pttButton.classList.toggle("idle", !value);
                                pttButton.disabled = false;
                                break;

                            case "isLoading":
                                if (value) {
                                    pttButton.classList.remove("recording");
                                    pttButton.classList.remove("idle");
                                    pttButton.textContent = i18n.sending;
                                    pttButton.disabled = value;
                                }
                                break;

                            case "streamingText":
                                if (textDisplay) {
                                    textDisplay.textContent = value;
                                }
                                break;

                            case "isStreaming":
                                if (textDisplay) {
                                    textDisplay.classList.toggle("streaming", value);
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

        this.domElements = {
            audio: null,
            pttButton: null,
            mouthElement: null,
            langSelector: null,
            errorMessage: null,
            i18n: null,
            textDisplay: null
        };
    }

    // Getter for the state
    get state() {
        return this._state;
    }

    // Singleton instance
    static get instance() {
        if (!this._instance) {
            this._instance = new AppState();
        }
        return this._instance;
    }

    // Set DOM elements reference
    setDomElements(elements) {
        this.domElements = { ...this.domElements, ...elements };
    }
}

export default AppState.instance; 