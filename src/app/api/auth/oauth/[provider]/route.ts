import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizeUrl, generatePkcePair, generateState, googleConfig, githubConfig, linkedinConfig } from "@/lib/auth/oauth";

export const OAUTH_STATE_COOKIE = "qrify_oauth_state";

function configFor(provider: string) {
  if (provider === "google") return googleConfig();
  if (provider === "github") return githubConfig();
  if (provider === "linkedin") return linkedinConfig();
  return null;
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/auth/oauth/[provider]">) {
  const { provider } = await ctx.params;

  let config;
  try {
    config = configFor(provider);
  } catch {
    config = null;
  }
  if (!config) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(`${provider} sign-in is not configured on this deployment`)}`, request.url),
    );
  }

  const state = generateState();
  const { verifier, challenge } = generatePkcePair();
  const next = request.nextUrl.searchParams.get("next") ?? "/onboarding";

  const response = NextResponse.redirect(buildAuthorizeUrl(config, state, challenge));
  response.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, verifier, provider, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
