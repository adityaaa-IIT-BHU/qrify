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
| Disconnect an individual source | 🟡 Schema-ready (`ProfileSource.status = DISCONNECTED`, soft-delete on facts) — **no UI action wired yet.** |
| Delete individual profile facts | 🟡 Schema supports it (`ProfileFact` rows are addressable) — no UI yet. |
| Export profile | 🟡 Not built. All data is already structured (not a scraping/reconstruction problem) — a JSON export endpoint is a small, well-scoped addition. |
| Delete account | 🟡 Soft-delete columns exist on `User` and everything it owns — the actual delete-account *flow* (confirmation, cascading soft-delete, audit event) is not built. **Called out as a pre-launch blocker in ROADMAP, not glossed over.** |
| Revoke OAuth connections | 🟡 `OAuthConnection` rows are deletable; no "Disconnect" button wired in the UI yet. |

This table exists specifically so nobody mistakes "the schema supports it" for "the feature ships" — a distinction the brief is explicit about caring about.

## What an employer receives

An employer only ever sees: the candidate's name, email, headline, location, portfolio/GitHub links, the specific resume version submitted for *that* application, and the answers submitted for *that* application's screening questions (`GET /api/employer/jobs/[id]/applicants` — explicit `select`, not a raw relation dump; see [SECURITY.md § Findings Fixed During Build](./SECURITY.md) for the leak that was caught and fixed here). An employer never sees a candidate's full profile, other applications, or account credentials.

## Data QRify never collects or infers

- No protected characteristics (age, gender, religion, ethnicity, marital/family status, disability) — extraction prompts explicitly forbid recording these even when mentioned in source material (`src/lib/ai/profile-extraction.ts`).
- No opaque candidate "quality score" — every match is a transparent percentage with visible supporting evidence (`src/lib/ai/matching.ts`).
- No behavioral tracking beyond what's needed for the product funnel (`QRScan`, `AuditEvent`) — no ad pixels, no third-party analytics SDKs in this MVP.

## Fraud & quality signals (candidate-facing)

- `Employer.verifiedStatus` exists in the schema (`UNVERIFIED` / `EMAIL_VERIFIED` / `DOMAIN_VERIFIED`) so the candidate-facing apply screen can eventually show a trust signal before a candidate sends their resume to an unverified poster. **Not yet surfaced in the UI** — flagged as P1, not silently deferred.
- Job reporting ("this posting looks fraudulent") is not built.

## Before a real launch

This build is an engineering MVP, not a launched product, and the following are genuine blockers, not nice-to-haves:

1. Legal review of the DPDP/GDPR framing above by an actual privacy lawyer — the architectural implications listed in RESEARCH.md are a good-faith engineering read of the regulations, not legal sign-off.
2. Account-deletion flow (schema is ready; the flow isn't built).
3. Employer verification enforced as a real gate, not just a schema field.
4. A written incident-response runbook (see SECURITY.md § Known gaps).
