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
| Salted SHA-256 password hashing before comparison | Plaintext credential exposure; precomputed rainbow-table lookups against the stored hash | Client-side only — see Assumption 4 below; the salt is hardcoded per Assumption 1 (no registration flow to generate/store a real per-user salt); a production system must hash server-side with a proper KDF (e.g., bcrypt/Argon2), not raw salted SHA-256 |
| OTP expiry (60s) + single-use | Replay attacks | A captured/observed OTP becomes useless after first use or after the window closes |
| Rate limiting (lockout after 3 failed attempts) | Brute-force / exhaustive search on the 6-digit OTP space | Resets on page reload — see limitations |
| Generic error messages | Information leakage (an attacker inferring *which* factor failed) | Same wording whether the password or the OTP was wrong |
| In-memory audit log | No accountability/traceability otherwise | Records timestamp, user ID, outcome per attempt |

**Explicitly not attempted** (see limitations): server-side secret storage, TLS/transport security, real persistence of rate-limit state, protection against someone reading the OTP-generation logic directly out of the page source.

### 5.1 Why not asymmetric crypto (PKI certs / digital signatures / Diffie-Hellman)?

This came up during the group's security review, so it's worth recording the reasoning rather than leaving it implicit.

Asymmetric schemes like these solve problems that only exist when two parties, each holding a secret the other doesn't have, communicate over a channel an attacker can observe or tamper with:

- **PKI / certificates** let a party prove its identity to someone else using a private key it alone holds, verified against a public key.
- **Digital signatures** let a verifier confirm a message came from the holder of a specific private key, without trusting the channel it arrived on.
- **Diffie-Hellman** lets two parties agree on a shared secret over a channel an eavesdropper is watching, without ever transmitting that secret.

None of these apply here, because this app has no second party and no network channel: `index.html`, `auth.js`, and every other module run in the *same* browser JS context as anyone probing the app. There's no server to authenticate to, no counterpart to keep a private key secret from, and no wire to eavesdrop on — an attacker with the page open already has read access to anything this code could compute, including a "private" key. Adding a cert/DH/signature protocol on top of `auth.js` would add real implementation complexity while defending against nothing, and would contradict this project's own **Design Goal 2 (no backend)**.

The one weakness asymmetric crypto would legitimately have fixed — being able to trust a hash without trusting whoever computed it — is exactly what a real backend (§7) restores: once verification happens somewhere the attacker can't read the source of, salting/KDF choice starts to matter, and *then* TLS (which itself is built on Diffie-Hellman key exchange) and possibly client certificates become meaningful additions.

## 6. Assumptions & Limitations

Stated explicitly rather than left implicit, per the project brief's requirement that assumptions be reasonable and declared:

1. **Single hardcoded demo user** — no registration/account management flow.
2. **OTP delivered via browser TTS**, not a real SMS/telephony gateway — TTS is used as a faithful stand-in for an audio OTP delivery channel (comparable to a real voice-call OTP).
3. **No backend/database** — all state (credential hash, OTP, audit log, rate-limit counter) lives only in browser memory for the session and resets on reload.
4. **Client-side JS is visible in page source** — this means the hashing/OTP logic isn't truly secret, which runs counter to Kerckhoffs's Principle (security should rest on key secrecy, not algorithm secrecy). Acknowledged as a prototype limitation, not hidden. This is also why the demo password's salt is hardcoded rather than randomly generated (there's no registration flow to create and persist one, and it would be visible in source either way), and why asymmetric crypto (PKI/signatures/DH) isn't used — see §5.1.
5. **Assumes a functioning screen reader or reliance on the app's own audio output** — no support attempted for other assistive technologies (e.g., Braille displays).
6. **Rate limiting is not persisted** — reloading the page clears the lockout state.

## 7. Possible Production Changes

If this were taken beyond a prototype:
- Move password verification and OTP generation/validation to a real backend
- Replace TTS "delivery" with an actual SMS/voice-call OTP provider
- Persist rate-limiting and audit logs server-side (e.g., keyed by IP + user ID, surviving client reloads)
- Use a proper password hashing KDF (bcrypt/Argon2/scrypt) with a randomly generated, per-user salt instead of raw/hardcoded-salt SHA-256
- Serve over HTTPS/TLS as a baseline transport security requirement (this is where Diffie-Hellman actually earns its place — negotiating the session key for that channel)
- If mutual authentication is needed beyond passwords, add client certificates or a signed-token scheme once there's a real server to hold the corresponding private key (see §5.1 for why this doesn't apply to the current no-backend prototype)
- Expand assistive technology support beyond screen readers/audio
