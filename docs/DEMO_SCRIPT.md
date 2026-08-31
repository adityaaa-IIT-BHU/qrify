# Demo Script (5 minutes)

## Setup (do this before the room fills up)

```bash
docker compose up -d          # or use a local Postgres install — see README
cp .env.example .env          # fill in ANTHROPIC_API_KEY at minimum for live AI parsing
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

The seed script prints the two demo logins and a ready-to-scan apply link:

```
Candidate login:  candidate@qrify.app / Demo1234!
Employer login:   employer@qrify.app / Demo1234!
Demo apply link:  http://localhost:3000/j/{token}
```

It also creates 6 additional jobs across different personas (PM, ML, consulting, marketing, design-with-portfolio-requirement, internship) — useful for showing match-score variety if there's time.

## The script

**0:00 — The pitch.** Open `/` (landing page). "Applying for a job should be as fast as paying someone with a UPI QR code. That's the whole company."

**0:30 — Employer side.** Sign in as `employer@qrify.app`. Go to `/employer/jobs/new`. Click "Use a sample JD" (or paste a real one live — it's more convincing). Click "Parse with AI" — narrate what's happening while it spins: "This is one Claude call producing structured requirements and screening questions, not a keyword regex."

**1:30 — Show the parse.** On the job detail page: must-have vs. nice-to-have chips, extracted screening questions, editable location/comp/recruiter-email fields. Click "Generate QR." A real, scannable QR appears with download/copy options.

**2:15 — The candidate side.** Open a second browser/incognito window (or hand a phone to someone in the room that can hit your dev machine's IP). Sign in as `candidate@qrify.app`. Either scan the QR or paste the apply link directly.

**2:45 — The magic moment.** The apply screen loads: company, role, match percentage, the specific skills/experience that matched (each traceable to a real profile entry — click "preview" on the resume to prove it's not a canned screenshot), screening questions already answered from the candidate's saved vault. One button: "Apply →". Tap it.

**3:15 — "Applied ✓ 1.1 seconds."** This is a real, measured number (`serverPrepareMs` + client round trip), not a hardcoded string — say so, and offer to refresh and do it again to show it's consistent. Click "View what was sent" to show the immutable artifact record.

**3:45 — Back to the employer.** Refresh the job detail page. The applicant appears immediately with match score, resume, and answers. Click Shortlist.

**4:15 — The "why this isn't just a resume builder" close.** Open `/candidate/profile` — show connected sources (GitHub sync, resume, voice), the profile-completeness bar, the consent-mode picker. "The candidate did the work once. Every job they scan into from here reuses it — that reuse loop, not the AI writing, is the product."

**4:45 — Close.** "Everything you just watched — the parsing, the matching, the QR signing, the applicant inbox — is a working app tonight, not a mockup. What's not built yet is honestly listed in the repo's ROADMAP.md, and none of it is required for this loop to work."

## If asked "does the AI actually work or is this scripted"

Be straight about it: the seed data above was inserted directly (bypassing the LLM) so the *product mechanics* can be demoed without depending on a funded API key in the room. The JD-paste → AI-parse flow shown at 0:30–1:30 **is** a real live Claude call, request-shape-validated against the real API during development (see `docs/RESEARCH.md`) — if the demo machine has a funded `ANTHROPIC_API_KEY`, that part of the demo is fully real, not staged. Say which is which; don't blur it.

## Screens worth having open in tabs beforehand

`/`, `/login`, `/employer/jobs/new`, `/candidate/profile`, and the seeded apply link — avoids dead air while pages compile on first load (Next.js compiles routes on demand in dev mode; the *first* hit to any route can take a few seconds longer than subsequent ones).
