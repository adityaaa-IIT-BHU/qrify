import "server-only";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { randomToken, sha256Hex } from "@/lib/crypto";
import type { User } from "@/generated/prisma/client";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface CreateSessionOptions {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Route Handler / Server Action only — writes the session cookie. */
export async function createSession(userId: string, opts: CreateSessionOptions = {}): Promise<void> {
  const token = randomToken(32);
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Safe to call anywhere (Server Component, Route Handler, Server Action) — read-only. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256Hex(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date() || session.user.deletedAt) {
    return null;
  }

  return session.user;
}

/** Route Handler / Server Action only — revokes the session and clears the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = sha256Hex(token);
    await db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  jar.delete(SESSION_COOKIE);
}

/** Best-effort client IP for audit logs / rate limiting behind a proxy. */
export async function getRequestIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return h.get("x-real-ip");
}
