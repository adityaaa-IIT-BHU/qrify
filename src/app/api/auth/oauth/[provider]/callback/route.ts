import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCode,
  fetchProfile,
  googleConfig,
  githubConfig,
  linkedinConfig,
} from "@/lib/auth/oauth";
import { findOrCreateUserFromOAuth } from "@/lib/auth/user";
import { createSession, getRequestIp } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";
import { OAUTH_STATE_COOKIE } from "@/app/api/auth/oauth/[provider]/route";

function configFor(provider: string) {
  if (provider === "google") return googleConfig();
  if (provider === "github") return githubConfig();
  if (provider === "linkedin") return linkedinConfig();
  return null;
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/auth/oauth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieRaw = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const clearCookie = (res: NextResponse) => {
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  if (oauthError) {
    return clearCookie(NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(oauthError)}`, request.url)));
  }
  if (!code || !returnedState || !cookieRaw) {
    return clearCookie(NextResponse.redirect(new URL("/login?error=invalid_oauth_state", request.url)));
  }

  let saved: { state: string; verifier: string; provider: string; next: string };
  try {
    saved = JSON.parse(cookieRaw);
  } catch {
    return clearCookie(NextResponse.redirect(new URL("/login?error=invalid_oauth_state", request.url)));
  }

  if (saved.state !== returnedState || saved.provider !== provider) {
    return clearCookie(NextResponse.redirect(new URL("/login?error=oauth_state_mismatch", request.url)));
  }

  const config = configFor(provider);
  if (!config) {
    return clearCookie(NextResponse.redirect(new URL("/login?error=unknown_provider", request.url)));
  }

  try {
    const tokenResponse = await exchangeCode(config, code, saved.verifier);
    const profile = await fetchProfile(config, tokenResponse.access_token);
    const { userId, isNewUser } = await findOrCreateUserFromOAuth(config, profile, {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
      scope: tokenResponse.scope,
    });

    await createSession(userId, { ipAddress: await getRequestIp(), userAgent: request.headers.get("user-agent") });
    await recordAuditEvent({ actorUserId: userId, action: "auth.oauth_login", metadata: { provider } });

    const destination = isNewUser ? "/onboarding" : saved.next || "/candidate";
    return clearCookie(NextResponse.redirect(new URL(destination, request.url)));
  } catch (err) {
    console.error("[oauth callback] failed", provider, err);
    return clearCookie(NextResponse.redirect(new URL("/login?error=oauth_failed", request.url)));
  }
}
