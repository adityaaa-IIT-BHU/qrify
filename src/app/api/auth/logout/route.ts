import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";

export async function POST() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await recordAuditEvent({ actorUserId: user.id, action: "auth.logout" });
  return NextResponse.json({ ok: true });
}
