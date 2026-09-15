/**
 * Person E - Security module
 * Accessible MFA lecture assignment
 *
 * Responsibility:
 * - Rate limiting / lockout after repeated failed attempts
 * - In-memory audit logging of every authentication attempt
 * - Generic, factor-agnostic error text
 *
 * Matches the contract agreed in architecture.md section 2.1:
 *   checkRateLimit(uid) -> boolean
 *   logAttempt(uid, success)
 *   getGenericError() -> string
 *
 * State lives only in browser memory for the session (see architecture.md
 * Assumptions 3 and 6): reloading the page clears both the audit log and
 * any active lockout.
 */

export const GENERIC_SECURITY_ERROR =
  "Authentication failed. Please check your credentials and try again.";

/** Consecutive failed attempts (password or OTP) before lockout. */
const MAX_CONSECUTIVE_FAILURES = 3;

/** How long a lockout lasts once triggered. */
const LOCKOUT_DURATION_MS = 30_000;

/**
 * Per-user rate limit state, keyed by user ID.
 * @type {Map<string, { consecutiveFailures: number, lockedUntil: number|null }>}
 */
const rateLimitState = new Map();

/**
 * In-memory audit log, oldest attempt first.
 * @type {Array<{ timestamp: string, uid: string, success: boolean }>}
 */
const auditLog = [];

/**
 * @param {string} uid
 * @returns {{ consecutiveFailures: number, lockedUntil: number|null }}
 */
function getOrCreateState(uid) {
  let state = rateLimitState.get(uid);

  if (!state) {
    state = { consecutiveFailures: 0, lockedUntil: null };
    rateLimitState.set(uid, state);
  }

  return state;
}

/**
 * Whether uid is currently allowed to attempt authentication.
 * Auto-clears an expired lockout once its cooldown has elapsed, matching
 * the "Locked Out -> Login" transition in architecture.md section 3.
 *
 * @param {string} uid
 * @returns {boolean} true if allowed to proceed, false if locked out
 */
export function checkRateLimit(uid) {
  if (typeof uid !== "string" || !uid.trim()) {
    return true;
  }

  const state = rateLimitState.get(uid.trim());

  if (!state || state.lockedUntil === null) {
    return true;
  }

  if (Date.now() >= state.lockedUntil) {
    state.lockedUntil = null;
    state.consecutiveFailures = 0;
    return true;
  }

  return false;
}

/**
 * Record an authentication attempt outcome for uid: appends to the audit
 * log and updates the rate-limit / lockout counters.
 *
 * A successful attempt clears any failure streak. A failed attempt
 * increments the streak and triggers a lockout once
 * MAX_CONSECUTIVE_FAILURES consecutive failures are reached.
 *
 * @param {string} uid
 * @param {boolean} success
 */
export function logAttempt(uid, success) {
  const normalizedUid =
    typeof uid === "string" && uid.trim() ? uid.trim() : "(unknown)";

  auditLog.push({
    timestamp: new Date().toISOString(),
    uid: normalizedUid,
    success: Boolean(success)
  });

  const state = getOrCreateState(normalizedUid);

  if (success) {
    state.consecutiveFailures = 0;
    state.lockedUntil = null;
    return;
  }

  state.consecutiveFailures += 1;

  if (state.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    state.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
}

/**
 * Generic, factor-agnostic error message. Using identical wording for a
 * bad password and a bad/expired/reused OTP prevents an attacker from
 * inferring which factor failed (architecture.md section 5).
 *
 * @returns {string}
 */
export function getGenericError() {
  return GENERIC_SECURITY_ERROR;
}

/**
 * Read-only copy of the in-memory audit log, oldest attempt first.
 * @returns {Array<{ timestamp: string, uid: string, success: boolean }>}
 */
export function getAuditLog() {
  return auditLog.map((entry) => ({ ...entry }));
}

/**
 * Milliseconds remaining before uid's lockout clears, or 0 if not locked.
 * Intended for a Locked Out screen countdown.
 *
 * @param {string} uid
 * @returns {number}
 */
export function getLockoutRemainingMs(uid) {
  if (typeof uid !== "string" || !uid.trim()) {
    return 0;
  }

  const state = rateLimitState.get(uid.trim());

  if (!state || state.lockedUntil === null) {
    return 0;
  }

  return Math.max(0, state.lockedUntil - Date.now());
}
