// a11y.js
// Accessibility module for the Accessible MFA Demo.
// Person C owns this file.
//
// Main public functions:
//   announce(message)
//   focusNext(screen)
//   setupAccessibility()

const focusTargets = {
    login: "username",
    otp: "otp-input",
    success: "success-title",
    fail: "fail-title"
};

/**
 * Announce a message to screen readers.
 * Uses the aria-live region in index.html.
 */
export function announce(message) {
    const liveRegion = document.getElementById("aria-live");

    if (!liveRegion) {
        console.warn("ARIA live region not found.");
        return;
    }

    // Clear first so repeated messages can be announced.
    liveRegion.textContent = "";

    // Small delay improves repeated announcement detection.
    window.setTimeout(() => {
        liveRegion.textContent = message;
    }, 50);
}

/**
 * Move keyboard/screen-reader focus to the important
 * element of the selected screen.
 *
 * Supported screens:
 * login, otp, success, fail
 */
export function focusNext(screen) {
    const elementId = focusTargets[screen];

    if (!elementId) {
        console.warn(`Unknown screen: ${screen}`);
        return;
    }

    const element = document.getElementById(elementId);

    if (!element) {
        console.warn(`Focus target not found: ${elementId}`);
        return;
    }

    // Make sure the target's screen is visible before focusing it.
    element.focus();
}

/**
 * Add/verify accessibility attributes and keyboard behavior.
 */
export function setupAccessibility() {
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const otpInput = document.getElementById("otp-input");
    const replayButton = document.getElementById("replay-btn");
    const loginButton = document.getElementById("login-btn");
    const verifyButton = document.getElementById("verify-otp-btn");

    if (username) {
        username.setAttribute("aria-label", "Username");
    }

    if (password) {
        password.setAttribute("aria-label", "Password");
    }

    if (otpInput) {
        otpInput.setAttribute("aria-label", "Enter one-time password");
        otpInput.setAttribute("inputmode", "numeric");
    }

    if (replayButton) {
        replayButton.setAttribute(
            "aria-label",
            "Replay one-time password"
        );
    }

    if (loginButton) {
        loginButton.setAttribute("aria-label", "Login");
    }

    if (verifyButton) {
        verifyButton.setAttribute("aria-label", "Verify one-time password");
    }

    // Prevent non-numeric characters in the OTP field.
    if (otpInput) {
        otpInput.addEventListener("input", () => {
            otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
        });
    }
}

/**
 * Set up accessibility when the DOM is ready.
 */
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAccessibility);
} else {
    setupAccessibility();
}
