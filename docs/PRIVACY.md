# Privacy & Consent

See [RESEARCH.md § India DPDP Act & GDPR](./RESEARCH.md#india-dpdp-act-2023--gdpr--architectural-implications-not-legal-advice) for the regulatory framing this is built against — this document is the product/engineering side of the same commitment.

## Consent model

Three explicit modes, candidate-controlled, changeable anytime (`ConsentPolicy` model, `PATCH /api/candidate/consent`):

- **REVIEW** — see every generated material before it's sent.
- **ONE_TAP** — default for new users. Everything prepared automatically; one tap submits.
- **INSTANT** — opt-in only. If every required field is already covered by previously-approved data, scanning submits with no tap.

**Consent-by-action, not blanket opt-in**: a screening-question answer only becomes reusable (`CandidateAnswer.approvedForReuse = true`) when the candidate explicitly approves it — either during onboarding (pre-approved work-authorization/notice-period answers) or by checking "save to vault" on a specific answer during a `REVIEW`-mode application. Nothing is silently learned and reused. See `src/lib/ai/screening-answers.ts`.

Every consent change is written to `AuditEvent` (`consent.changed`) with the actor, old/new mode is inferable from the ordered event log.

## What the candidate can do today vs. what's schema-ready but not yet wired

| Right (brief §28) | Status |
|---|---|
| See stored profile data | ✅ `/candidate/profile`, full profile via `GET /api/candidate/profile` |
| Correct it | ✅ `ProfileEditor` component, `PATCH /api/candidate/profile` |
| See what was sent per application | ✅ `/candidate/applications/[id]` — immutable `ApplicationArtifact`/`ApplicationAnswer` records |
| Change auto-apply authorization | ✅ consent mode change, above |
| Disconnect an individual source | ✅ `DELETE /api/candidate/sources/[id]` + a "Disconnect" action on `/candidate/profile` — soft-deletes the facts it produced, verified live. |
| Delete individual profile facts | 🟡 Schema supports it (`ProfileFact` rows are addressable) — no UI for deleting a single fact within a still-connected source (only whole-source disconnect is wired). |
| Export profile | ✅ `GET /api/candidate/profile/export` — full JSON dump (profile, facts, resumes metadata, applications), `Content-Disposition: attachment`. "Download my data" link on `/candidate/profile`. Verified live. |
| Delete account | ✅ `DELETE /api/candidate/account`, password-confirmed, revokes every session + OAuth token, deactivates `User`/`CandidateProfile`. Verified live (signup → delete → login correctly rejected → old session cookie correctly rejected). Submitted `Application`/`Job` history is deliberately retained, not purged — see the note below. |
| Revoke OAuth connections | ✅ Handled as part of account deletion (all `OAuthConnection` rows deleted). Revoking a single connection while keeping the account active is not yet a standalone action. |

This table exists specifically so nobody mistakes "the schema supports it" for "the feature ships" — a distinction the brief is explicit about caring about.

## What an employer receives

An employer only ever sees: the candidate's name, email, headline, location, portfolio/GitHub links, the specific resume version submitted for *that* application, and the answers submitted for *that* application's screening questions (`GET /api/employer/jobs/[id]/applicants` — explicit `select`, not a raw relation dump; see [SECURITY.md § Findings Fixed During Build](./SECURITY.md) for the leak that was caught and fixed here). An employer never sees a candidate's full profile, other applications, or account credentials.

## Data QRify never collects or infers

- No protected characteristics (age, gender, religion, ethnicity, marital/family status, disability) — extraction prompts explicitly forbid recording these even when mentioned in source material (`src/lib/ai/profile-extraction.ts`).
- No opaque candidate "quality score" — every match is a transparent percentage with visible supporting evidence (`src/lib/ai/matching.ts`).
- No behavioral tracking beyond what's needed for the product funnel (`QRScan`, `AuditEvent`) — no ad pixels, no third-party analytics SDKs in this MVP.

## Fraud & quality signals (candidate-facing)

- `Employer.verifiedStatus` (`UNVERIFIED` / `EMAIL_VERIFIED` / `DOMAIN_VERIFIED`) is now an enforced gate — an unverified employer cannot generate a job QR at all (see SECURITY.md), so no candidate can be scanning into an unverified employer's job in the first place. What's still missing: an explicit "verified employer" badge shown *to the candidate* on the apply screen itself (currently the guarantee is structural — unverified employers have no live QR to scan — rather than an explicit visible signal).
- Job reporting ("this posting looks fraudulent") is not built.

## Before a real launch

This build is an engineering MVP, not a launched product, and the following are genuine blockers, not nice-to-haves:

1. Legal review of the DPDP/GDPR framing above by an actual privacy lawyer — the architectural implications listed in RESEARCH.md are a good-faith engineering read of the regulations, not legal sign-off. In particular: legal input on whether account deletion should eventually offer full erasure of a candidate's own submitted-application history (currently retained for the employer's legitimate record-keeping — see above), not just account deactivation.
2. A written incident-response runbook (see SECURITY.md § Known gaps).
