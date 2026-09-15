/**
 * a11y.js
 * Person C - Accessibility module
 *
 * Responsibility:
 * - ARIA live region announcements for screen readers
 * - Focus management across screens
 * - Keyboard navigation (shortcuts for replay, escape to silence speech, etc.)
 */

/**
 * Announces a message to screen readers via the aria-live polite region.
 * Clears the content briefly first to guarantee screen readers re-announce
 * even if the message is identical to the previous one.
 * @param {string} message
 */
export function announce(message) {
  const liveRegion = document.getElementById("aria-live");
  if (!liveRegion) return;

  liveRegion.textContent = "";
  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 20);
}

/**
 * Switches between screens and moves keyboard focus to the first logical control.
 * @param {string} screenId - "screen-login", "screen-otp", "screen-result", or just "login", "otp", "result"
 */
export function focusNext(screenId) {
  const normalizedId = screenId.startsWith("screen-")
    ? screenId
    : `screen-${screenId}`;

  const allScreens = document.querySelectorAll(".screen");
  let targetScreen = null;

  allScreens.forEach((screen) => {
    if (screen.id === normalizedId) {
      screen.hidden = false;
      targetScreen = screen;
    } else {
      screen.hidden = true;
    }
  });

  if (!targetScreen) return;

  // Move focus to the first actionable element: text input, button, or heading
  const targetFocus = targetScreen.querySelector(
    "input:not([disabled]), button:not([disabled]), [tabindex='-1']"
  );
  if (targetFocus) {
    targetFocus.focus();
  }
}

/**
 * Sets up accessible keyboard shortcuts:
 * - Alt+R or pressing 'r'/'R' outside of text inputs triggers OTP replay
 * - Escape key immediately silences speech synthesis
 * @param {object} handlers
 * @param {Function} [handlers.onReplay] - Callback when replay shortcut is invoked
 */
export function setupKeyboardNav(handlers = {}) {
  document.addEventListener("keydown", (event) => {
    // Escape key stops TTS speech immediately
    if (event.key === "Escape") {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    // Check if the OTP screen is currently active
    const otpScreen = document.getElementById("screen-otp");
    const isOtpActive = otpScreen && !otpScreen.hidden;

    if (isOtpActive) {
      const isAltR = (event.key === "r" || event.key === "R") && event.altKey;
      const isR = event.key === "r" || event.key === "R";
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";

      // Trigger replay on Alt+R, or 'r' if not typing inside an input field
      if (isAltR || (isR && activeTag !== "input" && !event.ctrlKey && !event.metaKey)) {
        if (typeof handlers.onReplay === "function") {
          event.preventDefault();
          handlers.onReplay();
        }
      }
    }
  });
}

