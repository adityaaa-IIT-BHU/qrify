import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Optimistic auth gate only — checks whether a session cookie is present,
 * not whether it's actually valid (that would mean a DB call on every
 * request, which Next's own docs warn against doing in Proxy). Real
 * authorization happens in each Server Component/Route Handler via
 * getCurrentUser() (src/lib/auth/session.ts), which does hit the DB and is
 * the actual source of truth. This just avoids flashing a protected page
 * before redirecting an obviously-signed-out visitor.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;

  const isProtected = pathname.startsWith("/candidate") || pathname.startsWith("/employer") || pathname.startsWith("/onboarding");

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/candidate/:path*", "/employer/:path*", "/onboarding/:path*"],
};
