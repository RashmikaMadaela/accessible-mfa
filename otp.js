// otp.js
// Responsible for OTP generation, TTS, replay, expiry, and single-use

let currentOTP = null;
let otpGenerationTime = null;
const OTP_EXPIRY_MS = 30 * 1000; // 30 seconds
let isUsed = false;

/**
 * Generates a 6-digit random OTP, resets expiry and usage state.
 * @returns {string} The generated OTP.
 */
export function generateOTP() {
    // Generate a random number between 100000 and 999999
    currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
    otpGenerationTime = Date.now();
    isUsed = false;
    return currentOTP;
}

// Store utterance globally to prevent browser garbage collection bugs
let currentUtterance = null;

/**
 * Speaks the provided OTP using Web Speech API.
 * Spaces are added so digits are read individually.
 * @param {string} otp 
 */
export function speakOTP(otp) {
    if (!otp) return;
    
    // Add spaces between digits so screen reader says "1 2 3" instead of "one hundred twenty three"
    const spacedOtp = otp.split('').join(' ');
    
    // Cancel any ongoing speech before starting a new one
    window.speechSynthesis.cancel();
    
    currentUtterance = new SpeechSynthesisUtterance(`Your one time password is: ${spacedOtp}`);
    // Slow down the rate slightly for better accessibility comprehension
    currentUtterance.rate = 0.9;
    
    window.speechSynthesis.speak(currentUtterance);
}

/**
 * Replays the current OTP if it is not expired.
 */
export function replayOTP() {
    if (isExpired()) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance("Your one time password has expired. Please request a new one.");
        window.speechSynthesis.speak(utterance);
        return;
    }
    
    if (currentOTP) {
        speakOTP(currentOTP);
    }
}

/**
 * Checks if the current OTP has expired based on the 30-second window.
 * @returns {boolean}
 */
export function isExpired() {
    if (!otpGenerationTime) return true;
    return (Date.now() - otpGenerationTime) > OTP_EXPIRY_MS;
}

/**
 * Verifies the user input against the current OTP.
 * Ensures the OTP is not expired and hasn't been used successfully already.
 * @param {string} input 
 * @returns {boolean} True if verification is successful, false otherwise.
 */
export function verifyOTP(input) {
    if (!currentOTP) {
        return false;
    }
    
    if (isExpired()) {
        return false;
    }
    
    if (isUsed) {
        // Enforce single-use flag: cannot be reused after a successful verification
        return false; 
    }
    
    const cleanInput = typeof input === "string" ? input.trim() : String(input || "");
    if (cleanInput === currentOTP) {
        isUsed = true; // Mark as used to prevent replay attacks with the same OTP
        return true;
    }
    
    return false;
}

/**
 * Resets the current OTP state and cancels any ongoing speech.
 */
export function resetOTP() {
    currentOTP = null;
    otpGenerationTime = null;
    isUsed = false;
    if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}

