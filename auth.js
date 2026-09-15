/**
 * Person A - Authentication module
 * Accessible MFA lecture assignment
 *
 * Responsibility:
 * - Demo user lookup
 * - SHA-256 password hashing using Web Crypto / SubtleCrypto
 * - Password verification
 * - Generic authentication error text
 *
 * IMPORTANT:
 * The plaintext demo password is NOT stored in this file.
 * Only its SHA-256 hash is stored.
 */

export const GENERIC_AUTH_ERROR =
  "Authentication failed. Please check your credentials and try again.";

/**
 * Shared demo user from the team plan.
 * Password hash = SHA-256 of the agreed demo password.
 * The plaintext password is intentionally not stored here.
 */
const DEMO_USER = Object.freeze({
  uid: "user1",
  passwordHash:
    "d3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791"
});

/**
 * Convert an ArrayBuffer to a lowercase hexadecimal string.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-work string comparison for equal-length hexadecimal hashes.
 * This is mainly educational in a browser demo, but avoids a simple
 * early-return comparison.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let difference = 0;

  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return difference === 0;
}

/**
 * Hash a password with SHA-256 using the Web Crypto API.
 *
 * @param {string} password
 * @returns {Promise<string>} lowercase SHA-256 hex digest
 */
export async function hashPassword(password) {
  if (typeof password !== "string") {
    throw new TypeError("Password must be a string.");
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Web Crypto is unavailable. Run this project on localhost or HTTPS."
    );
  }

  const encoded = new TextEncoder().encode(password);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);

  return bufferToHex(digest);
}

/**
 * Shared function contract:
 * checkPassword(uid, pwd)
 *
 * Because SubtleCrypto is asynchronous, the practical browser signature is:
 * Promise<boolean>. Call it with:
 *
 *   const ok = await checkPassword(uid, pwd);
 *
 * @param {string} uid
 * @param {string} pwd
 * @returns {Promise<boolean>}
 */
export async function checkPassword(uid, pwd) {
  // Use the same result for an unknown user and an incorrect password.
  // This supports the team's generic-error requirement.
  if (typeof uid !== "string" || typeof pwd !== "string") {
    return false;
  }

  const normalizedUid = uid.trim();

  if (!normalizedUid || !pwd) {
    return false;
  }

  // Always hash the supplied password before deciding the result.
  const suppliedHash = await hashPassword(pwd);

  const userExists = normalizedUid === DEMO_USER.uid;
  const passwordMatches = safeEqual(
    suppliedHash,
    DEMO_USER.passwordHash
  );

  return userExists && passwordMatches;
}

/**
 * Development helper: returns only the demo user ID.
 * No password or plaintext secret is exposed.
 *
 * @returns {string}
 */
export function getDemoUserId() {
  return DEMO_USER.uid;
}
