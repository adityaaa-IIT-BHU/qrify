# QRify

**Applying for a job should be as fast as paying someone with a UPI QR code.**

An employer pastes a job description and gets a QR code, free. A returning candidate scans it and applies in about five seconds — QRify already understands the role and understands them, because they built their career profile once.

This is a working MVP, not a mockup. The full acceptance-test flow (employer pastes JD → AI parses it → QR generated → candidate scans → matched evidence + resume shown → tap Apply → "Applied ✓" → employer sees the applicant instantly) has been run end-to-end against a real Postgres database and a real browser — see [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md).

## Documentation

Start here, in this order if you're new to the project:

1. [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) — what it does and why, candidate/employer journeys, consent modes.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, the five-second-apply architecture, data model, diagrams.
3. [`docs/AI_SYSTEM.md`](docs/AI_SYSTEM.md) — the extraction/matching/generation pipeline, prompt design, factuality checking.
4. [`docs/API.md`](docs/API.md) — every route.
5. [`docs/SECURITY.md`](docs/SECURITY.md) / [`docs/PRIVACY.md`](docs/PRIVACY.md) — threat model, consent model, what's a real gap vs. what's covered.
6. [`docs/RESEARCH.md`](docs/RESEARCH.md) — what's actually available from LinkedIn/GitHub/ATS platforms, graded, not assumed.
7. [`docs/ROADMAP.md`](docs/ROADMAP.md) — P0 (done) / P1 / P2, and what's permanently out of scope.
8. [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — how to actually ship this.
9. [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — the 5-minute founder demo.
10. [`HANDOVER.md`](HANDOVER.md) — state of the build, what's next, written for whoever picks this up.

## Quickstart

```bash
# 1. Database — either Docker...
docker compose up -d
# ...or a local Postgres install (what this build actually used, no Docker
# available in that sandbox): brew install postgresql@16 && brew services start postgresql@16
# then: createuser qrify --pwprompt --createdb && createdb qrify -O qrify

# 2. Environment
cp .env.example .env
# Fill in at minimum: DATABASE_URL (matches whichever Postgres above),
# QR_TOKEN_SECRET / ENCRYPTION_KEY / IP_HASH_SALT (each: openssl rand -base64 32),
# ANTHROPIC_API_KEY (get one at console.anthropic.com — required for JD/resume
# parsing; the app runs without it but those features will error).

# 3. Install, migrate, seed
npm install
npm run db:migrate   # applies prisma/migrations/ to your database
npm run db:seed      # demo employer, candidate, and 7 jobs — prints login creds + a ready QR link

# 4. Run
npm run dev
```

Open `http://localhost:3000`. Seeded logins (also printed by `db:seed`):

- Candidate: `candidate@qrify.app` / `Demo1234!`
- Employer: `employer@qrify.app` / `Demo1234!`

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply migrations (interactive-safe — see note below) |
| `npm run db:generate` | Regenerate the Prisma client after a schema change |
| `npm run db:studio` | Prisma Studio (visual DB browser) |
| `npm run db:seed` | Demo data |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run test:e2e` | Playwright e2e — **requires `npm run dev` already running against a seeded database** in another terminal |

### A note on Prisma in non-interactive shells

`prisma migrate dev` refuses to run when it needs to confirm anything (including harmless warnings) in a non-interactive terminal — this includes running it from an AI coding agent. If you hit `"Prisma Migrate has detected that it was invoked by [an AI agent]"` or `"environment is non-interactive"`:

- For a normal schema change with no destructive warning: `npx prisma migrate dev --name your_migration_name` works fine in an interactive terminal (a real terminal, not a scripted/CI one).
- In a non-interactive context, use the diff-and-deploy pattern instead (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — this is exactly how every migration after the first was created during this build):
  ```bash
  npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/diff.sql
  # create prisma/migrations/{UTC-timestamp}_{name}/migration.sql with that content
  npx prisma migrate deploy
  ```
- **Never** pass `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` to `migrate reset` (or any destructive command) without a human explicitly, freshly confirming that exact action in that exact conversation — this is Prisma's own AI-safety guard, and it exists for a good reason. See `HANDOVER.md` for the one time this build asked for and received that confirmation, and why.

## Testing

- **Unit** (`tests/unit/`): pure logic — the deterministic matcher, QR token signing, field encryption. No DB, no network.
- **Integration** (`tests/integration/`): the real `prepareApplication`/`submitApplication` pipeline against a real Postgres — creates and tears down its own fixtures.
- **E2E** (`tests/e2e/`): Playwright, drives an actual browser against a running dev server + seeded database.

`server-only`-guarded modules (see `docs/ARCHITECTURE.md § Authentication` and `HANDOVER.md`) resolve correctly under Vitest via a test-only alias in `vitest.config.ts` — this does not weaken the real guard, which Next's own build still enforces for the browser bundle.

## Project structure

See [`docs/ARCHITECTURE.md § Repository structure`](docs/ARCHITECTURE.md#3-repository-structure).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS v4 · PostgreSQL · Prisma 7 · Anthropic Claude (`claude-opus-5`, structured outputs) · pluggable S3/local storage and Resend/console email. See [`docs/ARCHITECTURE.md § Stack`](docs/ARCHITECTURE.md#1-stack) for the reasoning behind each choice.

---

*This is not the Next.js you remember from training data — see `AGENTS.md` in this repo before making assumptions about App Router conventions; Next 16 changed several (middleware → Proxy, async `params`, the `prisma-client` generator's driver-adapter requirement, etc.). `HANDOVER.md` has the specifics that actually bit during this build.*
