# Security

## Threat model

| Threat | Mitigation | Where |
|---|---|---|
| QR tampering / forged apply links | HMAC-SHA256 signature over the token id, `timingSafeEqual` comparison, verified before any DB query | `src/lib/qr/token.ts` |
| QR / job enumeration | Token id is a non-sequential `cuid`; per-token-per-IP rate limiting (20/min); IPs never stored raw (salted, daily-bucketed hash) | `src/lib/qr/resolve.ts`, `src/lib/crypto.ts` (`hashIp`) |
| Fake job postings / employer impersonation | Email verification (`EMAIL_VERIFY` token flow) is a real, enforced gate: `POST /api/jobs/[id]/qr` returns 403 until `Employer.verifiedStatus` moves off `UNVERIFIED`. Domain verification (a stronger tier) is still schema-only. | `src/lib/auth/email-verification.ts`, `src/app/api/jobs/[id]/qr/route.ts`, `src/app/api/auth/verify-email/*` |
| Malicious JDs / prompt injection via uploaded documents | Every untrusted input (JD text, resume text, transcript, GitHub bio) is wrapped in an explicit "this is data, not instructions" frame before being sent to the model; the model is told to treat embedded commands as more data to extract from | `src/lib/ai/client.ts` |
| Resume malware | Only PDF/plain-text accepted (`isPdf`/`isText` check), 8MB cap, parsed via `pdf-parse` (no code execution surface) — file is never executed, only text-extracted | `src/app/api/candidate/resumes/route.ts` |
| OAuth token theft | Access/refresh tokens AES-256-GCM-encrypted at rest before hitting the DB; PKCE + state on every OAuth flow, round-tripped via short-lived `httpOnly` cookie | `src/lib/crypto.ts`, `src/lib/auth/oauth.ts` |
| PII leakage via file URLs | No storage provider ever returns a public URL — every file read goes through the authenticated `/api/files/[...key]` route, which checks the requester is either the owning candidate or an employer who actually received that exact file via a submitted application | `src/app/api/files/[...key]/route.ts` |
| Application spam / bot applications | Rate limiting on signup, login (per-email and per-IP), job creation, and QR scans | `src/lib/rate-limit.ts` + call sites |
| Cross-tenant data exposure | Every employer-scoped route checks `userCanManageJob()` (employer membership on the specific job's employer) before returning anything; every candidate-scoped route checks `candidateProfile.userId === user.id` | `src/lib/employer/access.ts` + route handlers |
| Unauthorized recruiter access | `EmployerMember` join table with roles (`OWNER`/`ADMIN`/`RECRUITER`); no user sees another employer's jobs/applicants | `prisma/schema.prisma`, `src/lib/employer/access.ts` |
| Account takeover | bcrypt (12 rounds) for passwords; sessions stored as `sha256(token)` only (a DB read doesn't yield a usable session); rate-limited login by email and IP | `src/lib/auth/password.ts`, `src/lib/auth/session.ts` |
| AI data exfiltration | The model is never given tools/network access — every AI call in this system is a single structured-output request with a bounded input payload the caller constructs; there is no agentic tool-use loop that could be steered into fetching or leaking unrelated data | `src/lib/ai/*` |

## Findings fixed during build

**Candidate `passwordHash` leaked to employers viewing applicants.** `GET /api/employer/jobs/[id]/applicants` originally used `candidateProfile: { include: { user: true } }`, which serializes every `User` field — including `passwordHash` — into the JSON response for any employer looking at their applicant list. Caught by inspecting a live response during manual end-to-end testing (not by an automated scan), fixed to an explicit `select: { name, email, image }` before this document was written. No other route in the codebase includes a full `User` relation in a response that reaches an untrusted party — verified via `grep -rn "user: true"` across `src/`.

## Non-negotiables

- Never bypass CAPTCHA or anti-bot protections. `BrowserAssistProvider` is a stub specifically because a real implementation would require this — it fails loudly rather than being built to circumvent anything (`src/lib/providers/stubs.ts`).
- Never scrape a platform whose ToS forbids it (LinkedIn, in particular — see RESEARCH.md).
- Never store a third-party password. QRify only ever handles its own bcrypt-hashed password or OAuth tokens (encrypted).
- Never send recruiter outreach without explicit candidate action — `draftOutreachMessage()` produces a draft only; there is no send-without-review path (`src/lib/ai/outreach.ts`).

## Encryption strategy

- **At rest, application-layer**: OAuth access/refresh tokens — AES-256-GCM, random 12-byte IV per value, `ENCRYPTION_KEY` (32-byte, base64, env var) never checked into source. Rotating the key invalidates every previously-encrypted value (documented in `src/lib/crypto.ts` — an explicit, known tradeoff for the MVP; key-versioning is a P1 if rotation-without-downtime is needed).
- **At rest, database-level**: relies on the hosting Postgres provider's disk encryption (Neon/Supabase/RDS all encrypt at rest by default) — not re-implemented at the application layer for every column, which would be excessive for an MVP and isn't what field-level encryption is for (it's reserved for genuine credentials: OAuth tokens).
- **In transit**: TLS is the deployment platform's responsibility (Vercel/any modern PaaS terminates TLS by default); `Session` cookies are marked `secure` in production.
- **Password hashing**: bcrypt, 12 rounds — one-way, not "encryption" in the reversible sense, correctly.

## Known gaps (stated, not hidden)

- **Rate limiting is single-instance** (in-memory `Map`) — correct for one server process, silently under-protective across multiple instances. Flagged in the code itself (`src/lib/rate-limit.ts` file comment) and in ROADMAP as the first infra item before horizontal scaling.
- **Employer email verification is enforced** (see the threat-model table above) — the remaining gap is domain verification (`DOMAIN_VERIFIED`, a stronger trust tier for e.g. a company career page embed), which is schema-ready but not built. Also not yet surfaced: a visible trust badge on the *candidate-facing* apply screen — the gate blocks QR generation, but a candidate scanning a QR from an already-verified employer doesn't currently see an explicit "verified employer" indicator.
- **No formal incident-response runbook** yet — `AuditEvent` gives an investigable trail, but the *process* for using it during an incident isn't written.
- **`npm audit`** currently reports vulnerabilities confined to Prisma's own dev-tooling dependency chain (`@mrleebo/prisma-ast` → `chevrotain` → `lodash`, used for parsing `.prisma` files inside `prisma` CLI commands) — not shipped in the production runtime bundle. Tracked for resolution when Prisma ships a fix upstream (or on the next Prisma major-version upgrade), not treated as urgent since it's dev-tooling-only exposure.
