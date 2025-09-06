import appState from "../features/state.mjs";

const BACKEND_BASE_URL = import.meta.env.VITE_BACKEND_URL;
const HEALTHCHECK_TIMEOUT = 1000 * 60 * 5; // 5 minutes
//const HEALTHCHECK_INTERVAL = 1000 * 1; // 10 minutes
const DIALOG_SELECTOR = "waking-up-dialog";

function showDialog() {
  const dialogExists = document.getElementById(DIALOG_SELECTOR);
  if (dialogExists) return;

  const template = (content) => `
    <div id="${DIALOG_SELECTOR}" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.4); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; padding: 2rem 3rem; border-radius: 10px; box-shadow: 0 2px 16px rgba(0,0,0,0.2); font-size: 1.2rem; text-align: center;">
        ${content}
      </div>
    </div>`;

  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = template(appState.domElements.i18n.wakingUp);
  document.body.appendChild(tempDiv.firstElementChild);
}

function hideDialog() {
  const wakingUpDialog = document.getElementById(DIALOG_SELECTOR);
  if (wakingUpDialog) wakingUpDialog.remove();
}

/** 
 * Attempts to wake up the backend by polling the /health endpoint.
 * Shows a modal dialog while waiting for the backend to become available.
 * Resolves once the backend responds successfully.
 */
export async function wakeUpBackend() {
  return new Promise((resolve) => {
    let intervalId = null;

    function tryWakeUp() {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        HEALTHCHECK_TIMEOUT
      );

      
      fetch(`${BACKEND_BASE_URL}/health`, { signal: controller.signal })
      .then(async (res) => {
        clearTimeout(timeoutId);
        if (res.ok) {
            //clearInterval(intervalId);
            hideDialog();
            resolve();
          }
        })
        .catch(() => {
          clearTimeout(timeoutId);
        });
    }

    showDialog();
    //intervalId = setInterval(tryWakeUp, HEALTHCHECK_INTERVAL);
    tryWakeUp();
  });
}
