# Architecture — accessible-mfa

This document describes the technical design of the accessible MFA system: component structure, module contracts, state flow, and the security/accessibility reasoning behind each design choice. It's the engineering companion to the group design document (which covers assumptions and references in more academic detail).

## 1. Design Goals

1. **Two independent authentication factors**, both fully usable without sight
2. **No backend** — the whole system runs as a single static page, to fit the project's time constraint (see [Assumptions](#6-assumptions--limitations))
3. **Security controls that map to real concepts**, not just cosmetic — every hardening measure below is tied to a specific attack class it defends against
4. **Accessibility as a first-class requirement**, not an afterthought bolted onto a visual UI

## 2. Component Architecture

The app is one HTML page (`index.html`) plus five independent JS modules, each wrapping one browser Web API. This split let the group build in parallel with minimal merge conflicts.

```
┌─────────────────────────────────────────────────────────────┐
│  Client (single page, browser-only)                          │
│                                                                │
│   index.html (screens: Login / OTP / Result)                 │
│        │                                                      │
│        ├──▶ auth.js      (password check, SHA-256 hashing)   │
│        │         │                                            │
│        ├──▶ otp.js       (OTP gen, TTS, replay, expiry)      │
│        │         │                                            │
│        ├──▶ a11y.js      (ARIA, aria-live, keyboard/focus)   │
│        │         │                                            │
│        ├──▶ audio.js     (success/fail chimes)                │
│        │         │                                            │
│        └──▶ security.js  (rate limit, audit log, errors)     │
│                  │                                             │
└──────────────────┼─────────────────────────────────────────┘
                    ▼
       Browser Web APIs: SubtleCrypto, SpeechSynthesis,
                AudioContext, ARIA/DOM
```

### 2.1 Module Responsibilities & Contracts

| Module | Responsibility | Exposed functions | Web API |
|---|---|---|---|
| `auth.js` | Validate User ID/password against a stored hash; never compare or store plaintext | `checkPassword(uid, pwd) → boolean`<br>`hashPassword(pwd) → Promise<string>` | `crypto.subtle` |
| `otp.js` | Generate, speak, replay, expire, and single-use-enforce the OTP | `generateOTP() → string`<br>`speakOTP(otp)`<br>`replayOTP()`<br>`verifyOTP(input) → boolean`<br>`isExpired() → boolean` | `speechSynthesis` |
| `a11y.js` | ARIA semantics, live announcements, keyboard nav, focus management | `announce(message)`<br>`focusNext(screenId)`<br>`setupKeyboardNav()` | ARIA / DOM |
| `audio.js` | Distinct tonal feedback for success/failure | `playSuccessChime()`<br>`playFailChime()` | `AudioContext` |
| `security.js` | Rate limiting, audit logging, generic error text | `checkRateLimit(uid) → boolean`<br>`logAttempt(uid, success)`<br>`getGenericError() → string` | — (app logic) |

These signatures were agreed upfront by the group so each module could be built and unit-tested independently before integration.

## 3. Screen / State Flow

Three logical screens; transitions are driven entirely by authentication outcomes.

```
        ┌────────────┐   password OK    ┌────────────┐
  ──▶   │   Login    │ ───────────────▶ │  OTP Screen │
        │  Screen    │                   │ (spoken code│
        └────────────┘                   │  + entry)   │
              ▲                          └─────┬───┬───┘
              │ retry                          │   │
              │                    correct,    │   │ wrong / expired /
        ┌────────────┐          not expired,   │   │ reused
        │  Failure   │ ◀────────────────────────┘   │
        │  Screen    │ ◀─────────────────────────────┘
        └────────────┘
              │                          ┌────────────┐
        cooldown elapsed                 │  Success   │
              ▼                          │  Screen    │
        ┌────────────┐   3 consecutive   └────────────┘
        │ Locked Out │ ◀── failed OTP attempts (from OTP Screen)
        └────────────┘
```

- **Login → OTP**: on valid password
- **Login → Failure**: on invalid password
- **OTP → Success**: OTP correct, not expired, not already used
- **OTP → Failure**: OTP wrong, expired, or reused
- **OTP → Locked Out**: 3rd consecutive failed OTP attempt
- **Failure → Login**: user retries
- **Locked Out → Login**: after cooldown elapses

## 4. End-to-End Authentication Sequence

```
User                    App                         TTS/Screen Reader
 │                       │                                  │
 │  enter uid + password │                                  │
 ├──────────────────────▶│                                  │
 │                       │ hash password, compare           │
 │                       │                                  │
 │                       │── valid ──▶ generate OTP          │
 │                       │             start 60s timer       │
 │                       │             mark unused           │
 │                       │                                  │
 │                       ├─────────────────────────────────▶│ "Your code is 4 8 1 2 0 9"
 │                       │                                  │
 │  press Replay (opt.)  │                                  │
 ├──────────────────────▶│───────── re-speak same OTP ──────▶│
 │                       │                                  │
 │  enter OTP            │                                  │
 ├──────────────────────▶│                                  │
 │                       │ check: correct? not expired?      │
 │                       │ not used? rate limit OK?          │
 │                       │                                  │
 │                       │── pass ──▶ mark used, log success │
 │                       ├─────────────────────────────────▶│ success chime + "Login successful"
 │                       │                                  │
 │                       │── fail ──▶ log failure            │
 │                       ├─────────────────────────────────▶│ failure chime + generic error
 │                       │                                  │
 │                       │── 3rd fail ──▶ lockout            │
```

This sequence is also the group's integration test script — see the README's testing section.

## 5. Security Design Rationale

| Control | Defends against | Notes |
|---|---|---|
| Password hashing (SHA-256) before comparison | Plaintext credential exposure | Client-side only — see Assumption 4 below; a production system must hash server-side with a proper KDF (e.g., bcrypt/Argon2), not raw SHA-256 |
| OTP expiry (60s) + single-use | Replay attacks | A captured/observed OTP becomes useless after first use or after the window closes |
| Rate limiting (lockout after 3 failed attempts) | Brute-force / exhaustive search on the 6-digit OTP space | Resets on page reload — see limitations |
| Generic error messages | Information leakage (an attacker inferring *which* factor failed) | Same wording whether the password or the OTP was wrong |
| In-memory audit log | No accountability/traceability otherwise | Records timestamp, user ID, outcome per attempt |

**Explicitly not attempted** (see limitations): server-side secret storage, TLS/transport security, real persistence of rate-limit state, protection against someone reading the OTP-generation logic directly out of the page source.

## 6. Assumptions & Limitations

Stated explicitly rather than left implicit, per the project brief's requirement that assumptions be reasonable and declared:

1. **Single hardcoded demo user** — no registration/account management flow.
2. **OTP delivered via browser TTS**, not a real SMS/telephony gateway — TTS is used as a faithful stand-in for an audio OTP delivery channel (comparable to a real voice-call OTP).
3. **No backend/database** — all state (credential hash, OTP, audit log, rate-limit counter) lives only in browser memory for the session and resets on reload.
4. **Client-side JS is visible in page source** — this means the hashing/OTP logic isn't truly secret, which runs counter to Kerckhoffs's Principle (security should rest on key secrecy, not algorithm secrecy). Acknowledged as a prototype limitation, not hidden.
5. **Assumes a functioning screen reader or reliance on the app's own audio output** — no support attempted for other assistive technologies (e.g., Braille displays).
6. **Rate limiting is not persisted** — reloading the page clears the lockout state.

## 7. Possible Production Changes

If this were taken beyond a prototype:
- Move password verification and OTP generation/validation to a real backend
- Replace TTS "delivery" with an actual SMS/voice-call OTP provider
- Persist rate-limiting and audit logs server-side (e.g., keyed by IP + user ID, surviving client reloads)
- Use a proper password hashing KDF (bcrypt/Argon2/scrypt) instead of raw SHA-256
- Serve over HTTPS/TLS as a baseline transport security requirement
- Expand assistive technology support beyond screen readers/audio
