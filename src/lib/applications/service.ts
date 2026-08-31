import "server-only";
import { db } from "@/lib/db";
import { loadCandidateEvidence } from "@/lib/candidate/evidence";
import { matchCandidateToJob, type MatchResult } from "@/lib/ai/matching";
import { resolveVaultAnswer } from "@/lib/ai/screening-answers";
import { selectProviders } from "@/lib/providers";
import { recordAuditEvent } from "@/lib/audit";
import { fileServeUrl } from "@/lib/storage";
import type { ResumeContent, FactualityCheck } from "@/lib/ai/schemas";
import type { ApplicationProviderType, ConsentMode } from "@/generated/prisma/client";

export interface PreparedAnswer {
  screeningQuestionId: string;
  questionText: string;
  answerText: string | null;
  source: "AUTOFILLED_KNOWN" | "GENERATED" | "CANDIDATE_PROVIDED" | null;
  required: boolean;
}

export interface PrepareResult {
  applicationId: string;
  jobTitle: string;
  companyName: string;
  matchResult: MatchResult;
  resumeVersionId: string | null;
  resumeFileUrl: string | null;
  answers: PreparedAnswer[];
  missingRequiredQuestionIds: string[];
  hasResume: boolean;
  eligibleForFastApply: boolean; // no missing resume, no unanswered required questions, no failed factuality check
  consentMode: ConsentMode;
  /** Wall-clock time this function itself took — surfaced so the client can report a true scan-to-submit duration without calling Date.now() inside a Server Component render (React purity rule). */
  serverPrepareMs: number;
}

/**
 * Runs on the candidate's scan -> apply hot path. Everything here is either
 * a DB read, a deterministic computation (src/lib/ai/matching.ts), or a
 * vault lookup — no LLM call, so this comfortably fits inside the
 * five-second budget. See docs/ARCHITECTURE.md § The Five-Second
 * Application for the full reasoning.
 */
export async function prepareApplication(candidateProfileId: string, jobId: string): Promise<PrepareResult> {
  const startedAt = Date.now();
  const [job, { profile, evidenceItems }] = await Promise.all([
    db.job.findUniqueOrThrow({
      where: { id: jobId },
      include: { requirements: true, screeningQuestions: { orderBy: { order: "asc" } }, employer: true },
    }),
    loadCandidateEvidence(candidateProfileId),
  ]);

  const matchResult = matchCandidateToJob(
    evidenceItems,
    job.requirements.map((r) => ({ id: r.id, kind: r.kind, label: r.label })),
  );

  const vaultAnswers = await db.candidateAnswer.findMany({ where: { candidateProfileId } });

  const resumeSelection = await selectResumeVersion(candidateProfileId, jobId);

  const answers: PreparedAnswer[] = job.screeningQuestions.map((q) => {
    const vaultHit = resolveVaultAnswer(
      { id: q.id, questionText: q.questionText, canonicalKey: q.canonicalKey, required: q.required },
      vaultAnswers.map((v) => ({ questionKey: v.questionKey, answerText: v.answerText, approvedForReuse: v.approvedForReuse })),
    );
    return {
      screeningQuestionId: q.id,
      questionText: q.questionText,
      answerText: vaultHit?.answerText ?? null,
      source: vaultHit?.source ?? null,
      required: q.required,
    };
  });

  const missingRequiredQuestionIds = answers.filter((a) => a.required && a.answerText === null).map((a) => a.screeningQuestionId);

  const consentPolicy = await db.consentPolicy.findUnique({ where: { candidateProfileId } });
  const consentMode: ConsentMode = consentPolicy?.mode ?? "ONE_TAP";

  const application = await db.application.create({
    data: {
      jobId,
      candidateProfileId,
      status: missingRequiredQuestionIds.length > 0 || !resumeSelection ? "AWAITING_REVIEW" : "PREPARED",
      matchScore: matchResult.score,
      consentModeUsed: consentMode,
      providerType: "QRIFY_NATIVE",
    },
  });

  if (resumeSelection) {
    await db.applicationArtifact.create({
      data: {
        applicationId: application.id,
        type: "RESUME",
        resumeVersionId: resumeSelection.versionId,
        content: JSON.stringify(resumeSelection.content ?? { note: "uploaded resume, no structured content" }),
      },
    });
  }

  for (const a of answers) {
    if (a.answerText) {
      await db.applicationAnswer.create({
        data: {
          applicationId: application.id,
          screeningQuestionId: a.screeningQuestionId,
          questionText: a.questionText,
          answerText: a.answerText,
          source: a.source ?? "AUTOFILLED_KNOWN",
        },
      });
    }
  }

  await recordAuditEvent({
    actorUserId: profile.userId,
    action: "application.prepared",
    targetType: "Application",
    targetId: application.id,
    metadata: { jobId, matchScore: matchResult.score },
  });

  return {
    applicationId: application.id,
    jobTitle: job.title,
    companyName: job.employer.name,
    matchResult,
    resumeVersionId: resumeSelection?.versionId ?? null,
    resumeFileUrl: resumeSelection ? fileServeUrl(resumeSelection.fileKey) : null,
    answers,
    missingRequiredQuestionIds,
    hasResume: Boolean(resumeSelection),
    eligibleForFastApply:
      Boolean(resumeSelection) && missingRequiredQuestionIds.length === 0 && resumeSelection?.factualityOk !== false,
    consentMode,
    serverPrepareMs: Date.now() - startedAt,
  };
}

async function selectResumeVersion(
  candidateProfileId: string,
  jobId: string,
): Promise<{ versionId: string; fileKey: string; content: ResumeContent | null; factualityOk: boolean } | null> {
  const tailored = await db.resumeVersion.findFirst({
    where: { resume: { candidateProfileId, kind: "TAILORED" }, generatedForJobId: jobId, isCurrent: true },
  });

  const chosen =
    tailored ??
    (await db.resumeVersion.findFirst({
      where: { resume: { candidateProfileId, kind: "MASTER" }, isCurrent: true },
      orderBy: { createdAt: "desc" },
    })) ??
    (await db.resumeVersion.findFirst({
      where: { resume: { candidateProfileId, kind: "UPLOADED" } },
      orderBy: { createdAt: "desc" },
    }));

  if (!chosen || !chosen.fileUrl) return null;

  const parsed = chosen.parsedContent as { content?: ResumeContent; factuality?: FactualityCheck } | null;
  return {
    versionId: chosen.id,
    fileKey: chosen.fileUrl,
    content: parsed?.content ?? null,
    factualityOk: parsed?.factuality ? parsed.factuality.overallPass : true,
  };
}

export interface SubmitResult {
  application: { id: string; status: string; submittedAt: Date | null };
  elapsedMs: number;
  deliveries: Array<{ providerType: ApplicationProviderType; success: boolean; error?: string }>;
}

export async function submitApplication(applicationId: string): Promise<SubmitResult> {
  const application = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      job: true,
      candidateProfile: { include: { user: true } },
      artifacts: true,
      answers: true,
    },
  });

  if (application.status === "SUBMITTED") {
    return {
      application: { id: application.id, status: application.status, submittedAt: application.submittedAt },
      elapsedMs: 0,
      deliveries: [],
    };
  }

  const providers = selectProviders(application.job);
  const resumeArtifact = application.artifacts.find((a) => a.type === "RESUME");

  const deliveries: SubmitResult["deliveries"] = [];
  for (const provider of providers) {
    const attempt = await db.submissionAttempt.create({
      data: {
        applicationId,
        attemptNumber: 1,
        providerType: provider.type,
        status: "PENDING",
      },
    });

    const result = await provider.deliver({
      applicationId,
      job: application.job,
      candidateName: application.candidateProfile.user.name ?? application.candidateProfile.user.email,
      candidateEmail: application.candidateProfile.user.email,
      resumeBuffer: null, // providers that need bytes fetch via storage using resumeArtifact.resumeVersionId; MVP providers (native, email) link instead of attaching
      resumeFileName: "resume.pdf",
      coverNote: null,
      answers: application.answers.map((a) => ({ questionText: a.questionText, answerText: a.answerText })),
    });

    await db.submissionAttempt.update({
      where: { id: attempt.id },
      data: {
        status: result.success ? "SUCCESS" : "FAILED",
        errorMessage: result.error,
        completedAt: new Date(),
        responseSnapshot: result as never,
      },
    });

    deliveries.push({ providerType: provider.type, success: result.success, error: result.error });
  }

  const nativeOk = deliveries.find((d) => d.providerType === "QRIFY_NATIVE")?.success ?? false;
  const submittedAt = new Date();

  const updated = await db.application.update({
    where: { id: applicationId },
    data: {
      status: nativeOk ? "SUBMITTED" : "FAILED",
      submittedAt: nativeOk ? submittedAt : null,
      providerType: "QRIFY_NATIVE",
    },
  });

  await recordAuditEvent({
    actorUserId: application.candidateProfile.userId,
    action: nativeOk ? "application.submitted" : "application.submit_failed",
    targetType: "Application",
    targetId: applicationId,
    metadata: { deliveries },
  });

  void resumeArtifact; // reserved for attaching resume bytes to richer delivery providers (P1)

  return {
    application: { id: updated.id, status: updated.status, submittedAt: updated.submittedAt },
    elapsedMs: submittedAt.getTime() - application.startedAt.getTime(),
    deliveries,
  };
}
