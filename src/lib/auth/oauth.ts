import "server-only";
import { createHash } from "node:crypto";
import { randomToken } from "@/lib/crypto";

/**
 * Minimal, transparent OAuth 2.0 Authorization Code + PKCE client.
 *
 * We hand-roll this instead of pulling in a third-party OAuth library: the
 * two providers we need (Google, GitHub) have stable, well-documented
 * endpoints, and this is security-sensitive enough that "read every line
 * that touches a token" is worth the ~150 lines. (We evaluated `arctic` —
 * npm flags it "no longer supported" — and didn't want unmaintained code in
 * the token-exchange path.)
 *
 * Flow: buildAuthorizeUrl() -> redirect user -> provider redirects back with
 * `code` + `state` -> exchangeCode() -> fetchProfile(). The `state` and PKCE
 * `code_verifier` are round-tripped via a short-lived httpOnly cookie set by
 * the caller (see app/api/auth/oauth/[provider]/route.ts) — never trust the
 * client to hand back state/verifier some other way.
 */

export interface OAuthProviderConfig {
  id: "google" | "github" | "linkedin";
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

export interface OAuthProfile {
  providerAccountId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  raw: unknown;
}

export function googleConfig(): OAuthProviderConfig {
  return {
    id: "google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: `${requireEnv("APP_URL")}/api/auth/oauth/google/callback`,
    scope: "openid email profile",
  };
}

export function githubConfig(): OAuthProviderConfig {
  return {
    id: "github",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    clientId: requireEnv("GITHUB_CLIENT_ID"),
    clientSecret: requireEnv("GITHUB_CLIENT_SECRET"),
    redirectUri: `${requireEnv("APP_URL")}/api/auth/oauth/github/callback`,
    // read:user + user:email is enough: GitHub returns the authenticated
    // user's *public* repos from /user/repos with no elevated scope at all,
    // which is all the candidate-profile GitHub sync needs (least privilege).
    scope: "read:user user:email",
  };
}

/**
 * "Sign In with LinkedIn (OpenID Connect)" — identity only (name, email,
 * avatar). LinkedIn does NOT grant third-party apps API access to a user's
 * full profile (positions, education, connections) without a Talent/Marketing
 * Partner agreement (docs/RESEARCH.md § LinkedIn). So connecting LinkedIn in
 * QRify verifies identity and pre-fills name/photo — it is never a source of
 * Experience/Education facts. Gated behind LINKEDIN_CLIENT_ID being set;
 * unset in this MVP's .env by default (see .env.example), so the UI hides
 * the button rather than offering a broken flow.
 */
export function linkedinConfig(): OAuthProviderConfig {
  return {
    id: "linkedin",
    authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    clientId: requireEnv("LINKEDIN_CLIENT_ID"),
    clientSecret: requireEnv("LINKEDIN_CLIENT_SECRET"),
    redirectUri: `${requireEnv("APP_URL")}/api/auth/oauth/linkedin/callback`,
    scope: "openid profile email",
  };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(32);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateState(): string {
  return randomToken(16);
}

export function buildAuthorizeUrl(
  config: OAuthProviderConfig,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (config.id === "google") {
    // Encourages a refresh token on first consent; harmless no-op for GitHub.
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
}

export async function exchangeCode(
  config: OAuthProviderConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`OAuth token exchange failed (${config.id}): ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export async function fetchProfile(
  config: OAuthProviderConfig,
  accessToken: string,
): Promise<OAuthProfile> {
  if (config.id === "google" || config.id === "linkedin") {
    const userinfoUrl =
      config.id === "google"
        ? "https://openidconnect.googleapis.com/v1/userinfo"
        : "https://api.linkedin.com/v2/userinfo";
    const res = await fetch(userinfoUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Failed to fetch ${config.id} profile: ${res.status}`);
    const data = (await res.json()) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };
    return {
      providerAccountId: data.sub,
      email: data.email ?? null,
      name: data.name ?? null,
      avatarUrl: data.picture ?? null,
      raw: data,
    };
  }

  // github
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
  });
  if (!userRes.ok) throw new Error(`Failed to fetch GitHub profile: ${userRes.status}`);
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
    email: string | null;
  };

  let email = user.email;
  if (!email) {
    const emailsRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json" },
    });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      email = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? null;
    }
  }

  return {
    providerAccountId: String(user.id),
    email,
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url,
    raw: user,
  };
}
