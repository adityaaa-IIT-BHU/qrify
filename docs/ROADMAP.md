# Roadmap

## P0 — shipped in this build

**Candidate**: auth (password/magic-link/Google/GitHub), resume upload + AI extraction, GitHub sync, manual profile editing, voice capture (7 prompts, browser STT + typed fallback), resume vault (versioned, immutable), QR scan → matched apply screen → submit, application history with immutable "what was sent" record, three consent modes.

**Employer**: auth, paste-JD job creation, AI JD parsing (requirements + screening questions), review/edit, QR generation (PNG/SVG/copy link), native applicant inbox, match scores, shortlist/reject.

**Infrastructure**: Postgres schema (32 models), pluggable storage (local/S3) and email (console/Resend) providers, authenticated file serving, signed/rate-limited QR resolution, audit logging, deterministic candidate-job matching, structured AI extraction pipeline with factuality checking, seed script, `docker-compose.yml` for local Postgres, full doc set (this folder).

**Verified live** (not just "should work"): full acceptance-test flow (§34 of the build brief) run against a real running server + real Postgres + real browser — see [DEMO_SCRIPT.md](./DEMO_SCRIPT.md).

## P1 — next

Roughly ordered by "closes a gap explicitly flagged elsewhere in these docs" first:

1. **Account deletion flow** — schema-ready, flow not built. Pre-launch blocker per PRIVACY.md.
2. **Employer verification enforced as a gate** — `Employer.verifiedStatus` exists but doesn't block job publishing yet.
3. **Profile source disconnection UI** — backend/schema ready (`ProfileSource.status`), no button wired.
4. **Profile export (JSON)** — data is already structured; small addition.
5. **Distributed rate limiting** — swap the in-memory `Map` (`src/lib/rate-limit.ts`) for Upstash Redis or equivalent before running more than one server instance.
6. **Confidence-threshold review gate** — `ProfileFact.confidence` is stored but not yet wired to force re-confirmation below a threshold (see AI_SYSTEM.md).
7. **Global applicants view** for employers (cross-job), not just per-job.
8. **MESSAGE / APPLY_INTRO QR UI** — `draftOutreachMessage()` exists; no QR-type picker or send/copy UI yet.
9. **Server-side ASR fallback** (Whisper/Deepgram) for browsers without `SpeechRecognition` support.
10. **CandidateAnswer vault management UI** — view/edit/revoke saved reusable answers directly (currently only writable via a REVIEW-mode application).
11. **First real ATS integration** — pick one (Greenhouse's Job Board API is the most self-serve starting point per RESEARCH.md) and wire `AtsApiProvider` for real, including per-employer credential storage.
12. **LinkedIn "Sign In"** UI wiring — config exists (`linkedinConfig()`), no login button yet (gated behind `LINKEDIN_CLIENT_ID` being set).
13. **Incident-response runbook.**

## P2 — scale

- Broader ATS ecosystem (Lever, Ashby, Workable, SmartRecruiters) behind the same `ApplicationProvider` interface.
- Public developer API for third-party integrations.
- Embeddings-based semantic matching layered on top of (not replacing) the deterministic keyword matcher, for better recall on paraphrased skills.
- Placement-cell dashboard (university career services bulk view).
- Enterprise SSO for employer accounts.
- Employer teams: richer roles, invite flows.
- Recruiter CRM integrations.
- Redis-backed queue if any future feature genuinely needs async background processing (none of the current P0/P1 items do).

## Explicitly out of scope, permanently

- Browser-assisted application submission that bypasses CAPTCHA/anti-bot protections — not a roadmap item, a hard boundary (SECURITY.md).
- LinkedIn profile scraping.
- Any feature that would require inventing candidate facts not present in source evidence.
