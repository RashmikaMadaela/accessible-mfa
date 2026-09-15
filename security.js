/**
 * security.js
 * Person E - Security hardening module
 * 
 * Responsibility:
 * - Rate limiting (lockout after N failed attempts to protect against brute-force)
 * - In-memory audit log (timestamp, uid, success)
 * - Generic error handling (preventing factor-leakage)
 */

export const GENERIC_AUTH_ERROR =
  "Authentication failed. Please check your credentials and try again.";

export const MAX_FAILED_ATTEMPTS = 3;
export const LOCKOUT_DURATION_MS = 60 * 1000; // 60 seconds lockout cooldown

// Map of uid -> { failedCount: number, lockedUntil: number | null }
const failureRecords = new Map();

// In-memory audit log array
const auditLog = [];

/**
 * Checks if the given user is currently allowed to attempt authentication.
 * @param {string} uid
 * @returns {boolean} True if allowed, false if locked out.
 */
export function checkRateLimit(uid) {
  if (!uid) return true;
  const record = failureRecords.get(uid);
  if (!record) return true;

  const now = Date.now();

  // If currently locked out
  if (record.lockedUntil && now < record.lockedUntil) {
    return false;
  }

  // If lockout cooldown has elapsed, reset counter
  if (record.lockedUntil && now >= record.lockedUntil) {
    record.failedCount = 0;
    record.lockedUntil = null;
    return true;
  }

  return record.failedCount < MAX_FAILED_ATTEMPTS;
}

/**
 * Records an authentication attempt in the audit log and updates rate-limiting state.
 * @param {string} uid
 * @param {boolean} success
 */
export function logAttempt(uid, success) {
  const timestamp = new Date().toISOString();
  const entry = Object.freeze({
    timestamp,
    uid: uid || "unknown",
    success: Boolean(success)
  });
  auditLog.push(entry);

  if (!uid) return;

  let record = failureRecords.get(uid);
  if (!record) {
    record = { failedCount: 0, lockedUntil: null };
    failureRecords.set(uid, record);
  }

  if (success) {
    record.failedCount = 0;
    record.lockedUntil = null;
  } else {
    record.failedCount += 1;
    if (record.failedCount >= MAX_FAILED_ATTEMPTS) {
      record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      console.warn(
        `[Security] Account "${uid}" locked out after ${record.failedCount} consecutive failed attempts.`
      );
    }
  }
}

/**
 * Returns the standard generic error message to prevent factor disclosure.
 * @returns {string}
 */
export function getGenericError() {
  return GENERIC_AUTH_ERROR;
}

/**
 * Returns a read-only copy of the in-memory audit log.
 * Useful for debugging and grading verification.
 * @returns {Array<{timestamp: string, uid: string, success: boolean}>}
 */
export function getAuditLog() {
  return [...auditLog];
}

/**
 * Resets rate limit counters (primarily for testing and demo resets).
 * @param {string} [uid]
 */
export function resetRateLimit(uid) {
  if (uid) {
    failureRecords.delete(uid);
  } else {
    failureRecords.clear();
  }
}

