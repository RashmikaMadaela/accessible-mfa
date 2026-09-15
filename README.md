# accessible-mfa

A multi-factor authentication (MFA) demo built for **visually impaired users**, built for CS3053 Computer Security group project.

Two factors — a password (something you know) and a spoken, time-bound one-time passcode (something you have) — with every interaction designed to work through audio and a screen reader, no sight required.

> **Scope note:** this is a client-side prototype for a time-boxed demo, not a production auth system. There is no backend, no real SMS gateway, and no persistence beyond the browser session. See [architecture.md](./architecture.md) and the group design document for the full list of assumptions and what a production version would need to change.

## Features

- **Factor 1 — Password login**, hashed client-side (SHA-256) before comparison
- **Factor 2 — Spoken OTP**, delivered via the browser's built-in text-to-speech (Web Speech API)
- **Replay button** — re-speaks the same OTP on demand ("didn't catch that? press R")
- **OTP expiry (60s) + single-use** — defends against replay
- **Rate limiting / lockout** after 3 consecutive failed OTP attempts — defends against brute force
- **Generic error messages** — never reveal whether the password or the OTP was wrong
- **Audio chimes** (Web Audio API) for success/failure, independent of speech
- **Full accessibility**: ARIA labels, `aria-live` status announcements, complete keyboard operability, managed focus across screens
- **In-memory audit log** of every attempt (timestamp, user ID, outcome)

## Quick Start

No build step, no dependencies, no server required.

```bash
git clone <this-repo-url>
cd accessible-mfa
```

Then just open `index.html` directly in a browser (or serve it locally, e.g. `python3 -m http.server` and visit `http://localhost:8000`).

**Demo credentials:**
| User ID | Password |
|---|---|
| `user1` | `demo123` |

## Project Structure

```
accessible-mfa/
├── index.html      # Shared HTML skeleton — all 3 screens (Login / OTP / Result)
├── auth.js          # Password check + SHA-256 hashing
├── otp.js           # OTP generation, TTS speak-out, replay, expiry, single-use
├── a11y.js          # ARIA roles, aria-live announcer, keyboard nav, focus mgmt
├── audio.js         # Success/failure chimes (Web Audio API oscillator tones)
├── security.js      # Rate limiting, audit log, generic error messages
└── architecture.md  # System design, diagrams, and module contracts
```

Each file was owned by one group member and can be read/tested independently — see `architecture.md` for the module responsibility table and the function signatures each one exposes.

## How It Works (60-second version)

1. User types their User ID and password
2. App hashes the password and checks it — if valid, generates a random 6-digit OTP
3. The OTP is **spoken aloud** (not shown as text) and expires in 60 seconds
4. User can press **Replay** to hear it again, then types the code back in
5. On success: a rising chime plays and "Login successful" is announced. On failure: a low buzz plays and a generic error is announced (3 failed attempts triggers a temporary lockout)

Full sequence diagram in [architecture.md](./architecture.md#4-end-to-end-authentication-sequence).

## Browser Requirements

Needs a browser supporting:
- `speechSynthesis` (Web Speech API) — for spoken OTP delivery
- `AudioContext` (Web Audio API) — for chimes
- `crypto.subtle` (SubtleCrypto) — for password hashing

All current versions of Chrome, Firefox, Edge, and Safari support these.

## Testing with a Screen Reader

This project was tested with:
- **VoiceOver** (macOS/iOS) — built in, `Cmd+F5` to toggle
- **NVDA** (Windows) — free, [download here](https://www.nvaccess.org/download/)

When testing, verify: every control is announced with a meaningful label, every state change (OTP spoken, error, success) is announced via the `aria-live` region, and the entire flow is completable using only the keyboard (no mouse).

## Known Limitations

These are declared design trade-offs, not oversights — see `architecture.md` Section 5 (Assumptions) for the full reasoning:

- Single hardcoded demo user; no registration/reset flow
- OTP is "sent" via TTS, not a real SMS/telephony channel
- No backend — all state resets on page reload, including the rate-limit counter
- Client-side JS is inherently visible to anyone inspecting the page source; this violates Kerckhoffs's Principle and is explicitly acknowledged rather than hidden
- No support for assistive technologies beyond screen readers/audio (e.g., Braille displays)

## Team

| Member | Module Owned |
|---|---|
| `<< Name >>` | `auth.js` — Password authentication & hashing |
| `<< Name >>` | `otp.js` — OTP generation & delivery |
| `<< Name >>` | `a11y.js` — Accessibility layer |
| `<< Name >>` | `audio.js` — Non-speech audio feedback |
| `<< Name >>` | `security.js` — Security hardening |

## Course

CS3053 Computer Security — University of Moratuwa
