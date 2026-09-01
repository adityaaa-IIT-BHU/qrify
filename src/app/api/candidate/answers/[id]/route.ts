import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";

const UpdateSchema = z.object({
  answerText: z.string().trim().min(1).max(4000).optional(),
  approvedForReuse: z.boolean().optional(),
});

async function ownedAnswer(userId: string, id: string) {
  const answer = await db.candidateAnswer.findUnique({ where: { id }, include: { candidateProfile: true } });
  if (!answer || answer.candidateProfile.userId !== userId) return null;
  return answer;
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/candidate/answers/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await ownedAnswer(user.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const answer = await db.candidateAnswer.update({ where: { id }, data: parsed.data });
  await recordAuditEvent({ actorUserId: user.id, action: "answer_vault.updated", targetType: "CandidateAnswer", targetId: id });

  return NextResponse.json({ answer });
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/candidate/answers/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await ownedAnswer(user.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.candidateAnswer.delete({ where: { id } });
  await recordAuditEvent({ actorUserId: user.id, action: "answer_vault.deleted", targetType: "CandidateAnswer", targetId: id });

  return NextResponse.json({ ok: true });
}
