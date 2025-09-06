import appState from "../features/state.mjs";
import { showErrorToast, showWarningToast, showInfoToast, showSuccessToast } from './toast.mjs';

export function setUpError() {
    const { errorMessage, closeErrorMessage } = appState.domElements;
    closeErrorMessage.addEventListener("click", () => {
        errorMessage.style.display = "none";
        closeErrorMessage.style.display = "none";
    });
}

export function showError(message) {
    const { errorMessage, closeErrorMessage } = appState.domElements;
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
    closeErrorMessage.style.display = "block";
}

// Export toast functions for easy access
export { showErrorToast, showWarningToast, showInfoToast, showSuccessToast };
