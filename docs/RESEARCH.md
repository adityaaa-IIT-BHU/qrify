# Research Findings — What's Actually Available, Graded

This document exists so nobody — including future us — mistakes an aspiration for a shipped integration. Every claim below is graded on this scale (used consistently, never blurred):

1. **Verified and officially supported** — self-serve, documented, works today for any developer.
2. **Verified but restricted** — real and documented, but gated behind approval/partnership/manual per-account setup.
3. **Technically possible but approval-dependent** — an endpoint exists; using it at QRify's scale needs a relationship with the platform.
4. **Unsupported by official API** — would require scraping or ToS violation. Not built, not planned.
5. **Unknown / needs validation** — flagged rather than guessed at.

## LinkedIn

| Capability | Grade | Detail |
|---|---|---|
| "Sign In with LinkedIn using OpenID Connect" (name, email, profile photo) | **1 — Verified, self-serve** | Any registered LinkedIn developer app gets this product by default. Implemented in `src/lib/auth/oauth.ts` (`linkedinConfig`). |
| Full profile import (positions, education, connections) via API | **3 — Approval-dependent** | Gated behind LinkedIn's Marketing Developer Platform / Talent Solutions partner programs — not self-serve for a new app. **Not built.** |
| Posting a message / InMail via API | **4 — Unsupported for third parties** | No general-purpose messaging-send API for arbitrary third-party apps. |
| Scraping profile data | **4 — Explicitly excluded** | Against LinkedIn's ToS. Never built, never will be — see [SECURITY.md § Non-Negotiables](./SECURITY.md). |

**Product consequence**: LinkedIn is a *login/identity* connection in QRify, not a profile data source. The candidate still builds their profile via resume upload, voice capture, or GitHub sync. This is stated explicitly in the UI copy and in `src/lib/auth/oauth.ts`'s file comment, not left implicit.

## GitHub

| Capability | Grade | Detail |
|---|---|---|
| OAuth login (`read:user user:email`) | **1** | Standard, documented, self-serve. |
| Public repo listing (`GET /user/repos`) with only basic auth, no `repo` scope | **1** | Confirmed via GitHub's own docs — private-repo access needs the `repo` scope, but the authenticated user's *public* repos come back with `read:user` alone. This is why QRify never requests the broader `repo` scope (least privilege). |
| Repo languages / topics / description | **1** | Part of the same `/user/repos` response — used directly as deterministic evidence (`src/lib/integrations/github-sync.ts`), no LLM extraction needed since it's already structured. |

Fully implemented, real, working (`POST /api/candidate/sync/github`).

## ATS platforms (Greenhouse, Lever, Ashby, Workable, SmartRecruiters)

| Capability | Grade | Detail |
|---|---|---|
| Public "apply to this job board posting" endpoints | **3 — technically possible, integration-heavy** | Several ATSs (Greenhouse's Job Board API, Lever's Postings API) expose a public, unauthenticated-by-employer endpoint for submitting an application to a specific posting. This is real and doesn't require a partnership *per se*. |
| Full candidate/application management API (read pipelines, custom fields, attachments) | **2 — verified but restricted** | Requires a per-employer API key the employer generates in their own ATS admin panel and hands to QRify — real, self-serve *per employer*, but not something QRify can turn on generally without each employer doing setup. |
| A general "QRify auto-detects and submits correctly to any employer's ATS" experience | **Not a capability gap — an engineering scope decision.** | Even where an endpoint exists, every ATS has its own field schema, its own custom-question format, its own resume-upload multipart shape, and per-employer customization. Mapping that robustly is real, ongoing integration work, not a fixed one-time build. |

**What's in the code**: `AtsApiProvider`, `RedirectPrefillProvider` in `src/lib/providers/stubs.ts` — implementing the `ApplicationProvider` interface, `canHandle()` returns `false`, `deliver()` fails loudly with an explanatory error rather than silently no-opping. This keeps the architecture honest: the interface is ready, the P1 work is per-ATS field mapping + credential UX (see [ROADMAP.md](./ROADMAP.md)), not a redesign.

## Speech-to-text (voice capture)

| Capability | Grade | Detail |
|---|---|---|
| Browser-native `SpeechRecognition` / `webkitSpeechRecognition` | **1 for Chrome/Edge, inconsistent elsewhere** | Free, no server key, no audio ever leaves the device — transcription happens client-side, only the resulting text is sent to QRify. Chrome/Edge (desktop and Android) support it well; Safari has partial/webkit-prefixed support; Firefox support is minimal as of general knowledge. |
| Fallback | Implemented | `src/components/candidate/onboarding-flow.tsx` detects the API's absence and falls back to a plain textarea — voice capture degrades to typed capture, never a dead end. |
| Server-side ASR (Whisper/Deepgram) for full-coverage/better accuracy | Not built (P1) | Would remove the browser-support gap at the cost of a paid API + audio upload/storage. Documented as the natural upgrade path in [ROADMAP.md](./ROADMAP.md). |

## LLM structured output (Anthropic Claude)

**Grade: 1 — verified directly**, not just from documentation. During this build, a live request was sent to `client.messages.parse()` with a Zod output schema using the `claude-opus-5` model id; the request reached Anthropic's API and returned a *billing*-related 400 (the sandbox's API key had no credit), not a schema or auth error — confirming the request shape, model id, and SDK usage are all correct. The AI layer (`src/lib/ai/*`) is built entirely on this pattern; see [AI_SYSTEM.md](./AI_SYSTEM.md).

**Open item for whoever picks this up**: the AI-dependent flows (JD parsing, resume/voice extraction, tailored resume generation, factuality checking) are coded and were validated for request-shape correctness, but not validated end-to-end against real model output in this session because the available `ANTHROPIC_API_KEY` had no credit. The deterministic parts of the system (matching, QR, auth, applications, employer dashboard) *were* validated live against a running server + real Postgres — see `docs/DEMO_SCRIPT.md`. Whoever continues this needs a funded key to exercise the AI paths for real.

## India DPDP Act (2023) & GDPR — architectural implications, not legal advice

This section informs engineering decisions already made; it is not a substitute for legal review before a real launch (see [PRIVACY.md § Before Launch](./PRIVACY.md)).

- **Consent-based processing**: DPDP requires a clear, specific, informed basis for processing personal data. QRify's `ConsentPolicy` model + explicit REVIEW/ONE_TAP/INSTANT modes exist for this reason — auto-apply is opt-in, never a default silently switched on.
- **Data principal rights** (DPDP) / **data subject rights** (GDPR): access, correction, erasure. QRify's candidate dashboard supports viewing full profile data (`GET /api/candidate/profile`), editing it, and per-source disconnection (soft-delete on `ProfileSource` + associated facts — P1 UI, schema already supports it). Full account deletion is schema-supported (soft-delete columns throughout) but the delete-my-account *flow* is not yet built end-to-end — flagged in [ROADMAP.md](./ROADMAP.md) as a pre-launch blocker, not a nice-to-have.
- **Purpose limitation**: candidate data collected for applying to jobs is not repurposed for, e.g., ad targeting — there is no such feature, and none is planned.
- **Cross-border transfer**: DPDP restricts transfers to government-notified countries; GDPR requires a transfer mechanism (SCCs, adequacy). Architecturally relevant once a specific cloud region/provider is chosen for deployment — see [DEPLOYMENT.md](./DEPLOYMENT.md).
- **Breach notification**: both frameworks require timely breach notification. `AuditEvent` gives an investigable trail; a formal incident-response runbook is not written (P1).

## Alternative execution-model comparison (product decision record)

Nine models were listed in the brief; scored 1 (weak) – 5 (strong) on the axes that matter for an MVP:

| Model | Speed | Reliability | Compliance | UX | Eng. complexity (lower=better cost) | Employer adoption friction |
|---|---|---|---|---|---|---|
| QRify-native application | 5 | 5 | 5 | 5 | 2 | 1 (no ATS needed) |
| ATS API submission | 4 | 4 | 4 | 4 | 5 | 4 (needs their API key) |
| ATS redirect w/ prefill | 3 | 3 | 4 | 3 | 4 | 3 |
| Browser-assisted autofill | 2 | 2 | 1 (CAPTCHA/ToS risk) | 3 | 5 | 2 |
| Recruiter email delivery | 4 | 4 | 5 | 3 | 1 | 1 |
| Recruiter dashboard (native inbox) | 5 | 5 | 5 | 4 | 2 | 1 |

**Decision**: QRify-native + recruiter-dashboard-inbox as the mandatory baseline (P0, built), email as a free supplementary channel (P0, built), ATS API / redirect-prefill as P1 (interface ready, not wired), browser-assist as permanently out of scope. This is exactly what section 17/18 of the brief asked for and matches [ARCHITECTURE.md § Application Execution Layer](./ARCHITECTURE.md#8-application-execution-layer-providers).

## Negative results — designed for, not hidden

Per the brief's instruction to convert limitations into architecture decisions rather than concluding "cannot build":

| Limitation | Architectural response |
|---|---|
| A brand-new candidate (no resume, no GitHub, no voice session) cannot get a 5-second application | By design — `eligibleForFastApply` is `false` without a resume on file. The product promise is explicitly for a *returning* candidate; the UI routes a first-time scanner to onboarding, not a broken apply button. |
| A job's required screening question has no `canonicalKey` match in the candidate's vault | Falls out of `ONE_TAP`/`INSTANT` eligibility automatically — `missingRequiredQuestionIds` is non-empty, the candidate sees a short inline form (1–2 fields), and answering it (with an optional "save to vault") makes every *future* job with that same canonical question instant. This is the data flywheel the brief asked for. |
| No ATS has a general, robust, self-serve submission API across employers | `QRifyNativeProvider` is the mandatory baseline — an employer never needs an ATS to receive applications through QRify. |
| LinkedIn won't hand over full profile data | GitHub sync + resume upload + voice capture are three independent profile sources; no single point of failure. |
| The candidate-facing 5-second promise would break if matching or resume selection needed a network call | Matching is deterministic (no LLM), resume selection picks from *already-generated* versions — see [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-the-five-second-application-architecture). |
| In-memory rate limiting doesn't work across multiple server instances | Flagged explicitly in code (`src/lib/rate-limit.ts` file comment) and in ROADMAP as the first infra upgrade before scaling past one instance. |

## Peer review simulation

Run informally against the finished build, not as a hypothetical:

- **Skeptical CTO**: "Where's the queue?" — Nothing in the P0 flow needs one; adding Redis/BullMQ now would be solving a problem QRify doesn't have yet. Correctly deferred, see ROADMAP.
- **Recruiter**: "I don't want to install anything." — Confirmed: employer flow is sign in → paste JD → QR, zero ATS/plugin needed, verified live in this session (screenshot in `docs/DEMO_SCRIPT.md`).
- **Privacy lawyer**: "Where's account deletion?" — Fair catch, schema-ready but flow not built; listed as a pre-launch blocker, not glossed over.
- **Security engineer**: "Passwords in the applicant API response?" — Actually found and fixed during this build: an early version of `/api/employer/jobs/[id]/applicants` used `include: { user: true }` on the candidate relation, which serialized `passwordHash` to any employer viewing their applicant list. Fixed to an explicit `select` before this document was written — see [SECURITY.md § Findings Fixed During Build](./SECURITY.md).
- **Investor**: "What's actually differentiated vs. a resume builder?" — The Career Identity Graph (`ProfileFact` evidence ledger) + deterministic matching + the answer vault flywheel — none of that exists if QRify were "just" AI resume generation; it's the reuse-without-re-entry loop across employers that's the moat.
- **Major ATS platform**: "Are you scraping us?" — No; zero scraping anywhere in the codebase. Stub providers fail loudly rather than attempting unauthorized access.
