import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

const AnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        screeningQuestionId: z.string(),
        answerText: z.string().trim().min(1).max(4000),
        saveToVault: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(20),
});

/** Fills in required screening-question answers a REVIEW-mode application was missing, then flips it back to PREPARED so /submit can proceed. */
export async function POST(request: Request, ctx: RouteContext<"/api/applications/[id]/answers">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const application = await db.application.findUnique({
    where: { id },
    include: { candidateProfile: true },
  });
  if (!application || application.candidateProfile.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = AnswersSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const questions = await db.screeningQuestion.findMany({
    where: { id: { in: parsed.data.answers.map((a) => a.screeningQuestionId) }, jobId: application.jobId },
  });
  const questionById = new Map(questions.map((q) => [q.id, q]));

  for (const a of parsed.data.answers) {
    const question = questionById.get(a.screeningQuestionId);
    if (!question) continue;

    await db.applicationAnswer.upsert({
      where: { applicationId_screeningQuestionId: { applicationId: id, screeningQuestionId: a.screeningQuestionId } },
      create: {
        applicationId: id,
        screeningQuestionId: a.screeningQuestionId,
        questionText: question.questionText,
        answerText: a.answerText,
        source: "CANDIDATE_PROVIDED",
      },
      update: { answerText: a.answerText, source: "CANDIDATE_PROVIDED" },
    });

    if (a.saveToVault && question.canonicalKey) {
      await db.candidateAnswer.upsert({
        where: { candidateProfileId_questionKey: { candidateProfileId: application.candidateProfileId, questionKey: question.canonicalKey } },
        create: {
          candidateProfileId: application.candidateProfileId,
          questionKey: question.canonicalKey,
          answerText: a.answerText,
          isReusable: true,
          approvedForReuse: true,
        },
        update: { answerText: a.answerText, approvedForReuse: true },
      });
    }
  }

  const requiredQuestions = await db.screeningQuestion.findMany({ where: { jobId: application.jobId, required: true } });
  const answered = await db.applicationAnswer.findMany({ where: { applicationId: id } });
  const stillMissing = requiredQuestions.filter((q) => !answered.some((a) => a.screeningQuestionId === q.id));

  const hasResumeArtifact = await db.applicationArtifact.findFirst({ where: { applicationId: id, type: "RESUME" } });

  const updated = await db.application.update({
    where: { id },
    data: { status: stillMissing.length === 0 && hasResumeArtifact ? "PREPARED" : "AWAITING_REVIEW" },
  });

  return NextResponse.json({ application: updated, missingRequiredQuestionIds: stillMissing.map((q) => q.id) });
}
