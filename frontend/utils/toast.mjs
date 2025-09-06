import appState from '../features/state.mjs';

// Toast types and their configurations
const TOAST_TYPES = {
    error: {
        icon: '❌',
        backgroundColor: '#dc2626',
        textColor: '#ffffff'
    },
    warning: {
        icon: '⚠️',
        backgroundColor: '#f59e0b',
        textColor: '#ffffff'
    },
    info: {
        icon: 'ℹ️',
        backgroundColor: '#3b82f6',
        textColor: '#ffffff'
    },
    success: {
        icon: '✅',
        backgroundColor: '#10b981',
        textColor: '#ffffff'
    }
};

// Toast queue and configuration
let toastQueue = [];
let isProcessingQueue = false;
const TOAST_DURATION = 5000; // 5 seconds
const MAX_TOASTS = 3; // Maximum toasts visible at once

/**
 * Creates a toast notification element
 */
function createToastElement(message, type = 'error') {
    const config = TOAST_TYPES[type] || TOAST_TYPES.error;
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        background-color: ${config.backgroundColor};
        color: ${config.textColor};
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-family: var(--system-font);
        font-size: 0.875rem;
        font-weight: 500;
        max-width: 400px;
        word-wrap: break-word;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        position: relative;
    `;

    const icon = document.createElement('span');
    icon.textContent = config.icon;
    icon.style.fontSize = '1rem';

    const messageText = document.createElement('span');
    messageText.textContent = message;
    messageText.style.flex = '1';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
        background: none;
        border: none;
        color: inherit;
        font-size: 1.25rem;
        font-weight: bold;
        cursor: pointer;
        padding: 0;
        margin-left: 0.5rem;
        opacity: 0.7;
        transition: opacity 0.2s;
    `;

    closeButton.addEventListener('mouseenter', () => {
        closeButton.style.opacity = '1';
    });

    closeButton.addEventListener('mouseleave', () => {
        closeButton.style.opacity = '0.7';
    });

    toast.appendChild(icon);
    toast.appendChild(messageText);
    toast.appendChild(closeButton);

    return toast;
}

/**
 * Shows a toast notification
 */
function showToastElement(toast) {
    const container = appState.domElements.toastContainer;
    if (!container) return;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });

    // Auto-dismiss
    const dismissTimer = setTimeout(() => {
        dismissToast(toast);
    }, TOAST_DURATION);

    // Manual dismiss
    const closeButton = toast.querySelector('button');
    const dismissHandler = () => {
        clearTimeout(dismissTimer);
        dismissToast(toast);
    };

    closeButton.addEventListener('click', dismissHandler);
    toast.addEventListener('click', dismissHandler);

    // Store dismiss handler for cleanup
    toast._dismissHandler = dismissHandler;
}

/**
 * Dismisses a toast with animation
 */
function dismissToast(toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        processQueue();
    }, 300);
}

/**
 * Processes the toast queue
 */
function processQueue() {
    if (isProcessingQueue || toastQueue.length === 0) return;

    const container = appState.domElements.toastContainer;
    if (!container) return;

    const currentToasts = container.children.length;
    const availableSlots = MAX_TOASTS - currentToasts;

    if (availableSlots > 0) {
        isProcessingQueue = true;
        const toastsToShow = toastQueue.splice(0, availableSlots);
        
        toastsToShow.forEach(toast => {
            showToastElement(toast);
        });

        setTimeout(() => {
            isProcessingQueue = false;
            processQueue();
        }, 100);
    }
}

/**
 * Main function to show a toast notification
 */
export function showToast(message, type = 'error') {
    const toast = createToastElement(message, type);
    toastQueue.push(toast);
    processQueue();
}

/**
 * Convenience functions for different toast types
 */
export function showErrorToast(message) {
    showToast(message, 'error');
}

export function showWarningToast(message) {
    showToast(message, 'warning');
}

export function showInfoToast(message) {
    showToast(message, 'info');
}

export function showSuccessToast(message) {
    showToast(message, 'success');
}
