// Split out from session.ts so proxy.ts (runs on the Edge runtime) can read
// the cookie name without pulling in Prisma/Node crypto — session.ts itself
// has heavy, Node-only, server-only imports that must never reach the edge
// bundle.
export const SESSION_COOKIE = "qrify_session";
