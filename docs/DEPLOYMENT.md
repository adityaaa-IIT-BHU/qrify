# Deployment

## Recommended stack

- **App**: Vercel (Next.js-native — zero-config for the App Router, Route Handlers, and Server Components used throughout).
- **Database**: any managed Postgres — Neon or Supabase are the easiest fits for a serverless deploy target (connection pooling matters at the edge; both provide a pooled connection string). AWS RDS works too if you're already on AWS.
- **Object storage**: S3-compatible — AWS S3, Cloudflare R2 (no egress fees, good default), or Supabase Storage if you're already on Supabase for the DB.
- **Email**: Resend (already the built-in `EmailProvider` implementation — `src/lib/email/resend.ts`).

## Steps

1. **Provision Postgres.** Get a connection string. Run migrations against it:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```
   (`migrate deploy` — not `migrate dev` — is the non-interactive, production-safe command; it applies existing migration files without prompting.)

2. **Generate secrets** (each is a `openssl rand -base64 32`, distinct values):
   - `QR_TOKEN_SECRET`, `ENCRYPTION_KEY`, `IP_HASH_SALT`.
   - **`ENCRYPTION_KEY` cannot be rotated without invalidating every stored OAuth token** (see SECURITY.md) — set it once, back it up somewhere safe (a secrets manager, not source control).

3. **Set every variable in `.env.example`** in your host's environment config. At minimum for the core loop to work: `DATABASE_URL`, `APP_URL` (your real domain), the three secrets above, `ANTHROPIC_API_KEY`. OAuth/email/S3 vars are optional — the app degrades gracefully without them (password auth still works without Google/GitHub configured; console email logging substitutes for Resend; local filesystem storage substitutes for S3 — **note**: local filesystem storage does not survive a redeploy on most serverless hosts and is not multi-instance-safe, so set `STORAGE_DRIVER=s3` for any real deployment).

4. **Register OAuth apps** (only if you want Google/GitHub/LinkedIn login):
   - Google: [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials) — redirect URI `{APP_URL}/api/auth/oauth/google/callback`.
   - GitHub: [github.com/settings/developers](https://github.com/settings/developers) — redirect URI `{APP_URL}/api/auth/oauth/github/callback`, scopes `read:user user:email`.
   - LinkedIn: only if pursuing Sign-In-with-LinkedIn — see RESEARCH.md for what it actually gets you (identity only, not profile data).

5. **Deploy.** `vercel --prod` (or connect the GitHub repo in the Vercel dashboard for auto-deploy on push to `main`). The `postinstall` script (`prisma generate`) runs automatically on every deploy.

6. **Seed (optional, for a demo environment only — never run against a real production database with real users)**:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:seed
   ```

## Local development

```bash
brew install postgresql@16 && brew services start postgresql@16   # or: docker compose up -d
cp .env.example .env
# fill in DATABASE_URL to match whichever Postgres you started, plus the
# three generated secrets and ANTHROPIC_API_KEY
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Note on Prisma tooling in a non-interactive shell: `prisma migrate dev` refuses to run non-interactively when there's anything to confirm (including harmless warnings). The workaround used throughout this build's history — safe for CI/scripted environments — is:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/diff.sql
# create prisma/migrations/{timestamp}_{name}/migration.sql with that content
npx prisma migrate deploy
```

`migrate deploy` never prompts. Reserve `migrate dev` for interactive terminals only.

## Environments

| Env var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | |
| `APP_URL` | Yes | Used to build every QR/apply/OAuth-callback URL — must match the real deployed origin |
| `QR_TOKEN_SECRET`, `ENCRYPTION_KEY`, `IP_HASH_SALT` | Yes | Generate once, store safely |
| `ANTHROPIC_API_KEY` | Yes for AI features | JD parsing, resume/voice extraction, tailoring, factuality all no-op/error without it |
| `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET`, `LINKEDIN_CLIENT_ID`/`SECRET` | No | Login buttons hide themselves when unset (see `src/app/login/page.tsx`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | No | Falls back to console-logging emails |
| `STORAGE_DRIVER`, `S3_*` | No (defaults to `local`) | **Set to `s3` for any real deployment** |
