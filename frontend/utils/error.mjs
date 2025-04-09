import appState from "../features/state.mjs";

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
