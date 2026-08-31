# API Reference

All routes are Next.js Route Handlers under `src/app/api/`. Auth is cookie-based (`qrify_session`) — no bearer tokens in this MVP. All mutating routes validate input with Zod and return `{ error }` with an appropriate status on failure. Every route reads the current user via `getCurrentUser()`; ownership/membership is re-checked server-side on every request, never trusted from a client-supplied id.

## Auth

| Route | Method | Body | Notes |
|---|---|---|---|
| `/api/auth/signup` | POST | `{email, password, name?}` | Rate-limited per IP (10/hr) |
| `/api/auth/login` | POST | `{email, password}` | Rate-limited per email + per IP |
| `/api/auth/logout` | POST | — | Revokes the current session |
| `/api/auth/magic-link/request` | POST | `{email}` | Always returns success (no user-enumeration oracle) |
| `/api/auth/magic-link/verify` | GET | `?token=` | Single-use, 15-min expiry |
| `/api/auth/oauth/[provider]` | GET | — | `provider`: `google`\|`github`\|`linkedin`. Starts PKCE flow. `?next=` redirect target |
| `/api/auth/oauth/[provider]/callback` | GET | — | Token exchange, profile fetch, session creation |

## Candidate

| Route | Method | Notes |
|---|---|---|
| `/api/candidate/profile` | GET / PATCH | Full profile read; PATCH updates headline/location/preferences/links |
| `/api/candidate/resumes` | GET / POST (multipart) | POST: PDF/text upload → storage + AI extraction → profile facts |
| `/api/candidate/sync/github` | POST | Requires an existing GitHub `OAuthConnection`; deterministic sync, no AI |
| `/api/candidate/voice/session` | POST | Creates a session, returns the 7 interview prompts |
| `/api/candidate/voice/session/[id]` | POST / PATCH | POST appends one answered prompt's transcript; PATCH finalizes + runs extraction |
| `/api/candidate/consent` | PATCH | `{mode: "REVIEW"\|"ONE_TAP"\|"INSTANT"}` |
| `/api/candidate/applications` | GET | This candidate's application history |
| `/api/candidate/applications/[id]` | GET | Full detail incl. immutable artifacts/answers ("what was sent") |

## Employer / jobs

| Route | Method | Notes |
|---|---|---|
| `/api/jobs` | GET / POST | POST: `{companyName, rawDescription}` → creates Employer (if needed) + Job + runs JD extraction synchronously |
| `/api/jobs/[id]` | GET / PATCH | PATCH: editable fields (location, compensation, recruiterEmail, deadline, status, ...) |
| `/api/jobs/[id]/qr` | POST | `{type: "APPLY"\|"MESSAGE"\|"APPLY_INTRO"}` (only `APPLY` has UI support) → reuses an existing non-revoked token or mints one; returns PNG data URL + SVG + apply URL |
| `/api/employer/jobs/[id]/applicants` | GET | Explicit field selection — never returns `User.passwordHash` (see SECURITY.md) |
| `/api/applications/[id]/status` | PATCH | Employer shortlist/reject, `{status, note?}` |

## Application flow (the money path)

| Route | Method | Notes |
|---|---|---|
| `/api/applications/prepare` | POST | `{qrToken}` — verifies the signed token, rate-limits, logs the scan, then (if authenticated + profiled) runs the deterministic prepare pipeline. Returns `AUTH_REQUIRED` / `PROFILE_REQUIRED` / `READY` |
| `/api/applications/[id]/answers` | POST | Fills required screening-question answers for an `AWAITING_REVIEW` application; optional `saveToVault` per answer |
| `/api/applications/[id]/submit` | POST | Runs every applicable `ApplicationProvider.deliver()`, records `SubmissionAttempt`s, flips status to `SUBMITTED`/`FAILED` |

Note: the `/j/[token]` **page** (not an API route) does its own server-side resolve + prepare on render for the primary UI flow — `/api/applications/prepare` exists for parity/programmatic access (a future native client) and is exercised by the same underlying functions.

## Files

| Route | Method | Notes |
|---|---|---|
| `/api/files/[...key]` | GET | The *only* way any resume/PDF is ever served. Authenticated + authorized per-request (owning candidate, or an employer who received that exact file via a submitted application) — no storage provider URL is ever public. |

## Not built (interface exists, no route)

`POST /messages/prepare`, `POST /messages/:id/send` (outreach-message sending — draft generation exists in `src/lib/ai/outreach.ts`, no send endpoint yet), `POST /webhooks/*` (no inbound webhook sources exist yet — no ATS integration is live). See [ROADMAP.md](./ROADMAP.md).
