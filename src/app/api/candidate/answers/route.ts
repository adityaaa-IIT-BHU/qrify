import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCandidateProfile } from "@/lib/candidate/profile";
import { recordAuditEvent } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ answers: [] });

  const answers = await db.candidateAnswer.findMany({
    where: { candidateProfileId: profile.id },
    orderBy: { questionKey: "asc" },
  });
  return NextResponse.json({ answers });
}

const CANONICAL_KEYS = [
  "WORK_AUTHORIZATION",
  "NOTICE_PERIOD",
  "RELOCATION",
  "SALARY_EXPECTATION",
  "REMOTE_PREFERENCE",
  "MOTIVATION",
] as const;

const CreateSchema = z.object({
  questionKey: z.enum(CANONICAL_KEYS),
  answerText: z.string().trim().min(1).max(4000),
});

/** Lets a candidate proactively pre-approve a reusable answer, not just via a REVIEW-mode application. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const profile = await ensureCandidateProfile(user.id);
  const answer = await db.candidateAnswer.upsert({
    where: { candidateProfileId_questionKey: { candidateProfileId: profile.id, questionKey: parsed.data.questionKey } },
    create: { candidateProfileId: profile.id, ...parsed.data, isReusable: true, approvedForReuse: true },
    update: { answerText: parsed.data.answerText, approvedForReuse: true },
  });

  await recordAuditEvent({ actorUserId: user.id, action: "answer_vault.created", targetType: "CandidateAnswer", targetId: answer.id });

  return NextResponse.json({ answer });
}
