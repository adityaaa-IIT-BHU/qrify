import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { disconnectSource } from "@/lib/candidate/disconnect-source";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/candidate/sources/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await disconnectSource(profile.id, id, user.id);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
