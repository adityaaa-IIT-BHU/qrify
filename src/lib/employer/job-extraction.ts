import "server-only";
import { db } from "@/lib/db";
import type { JobDescriptionExtraction } from "@/lib/ai/schemas";

/** Writes a JobDescriptionExtraction result onto a Job's fields + child JobRequirement/ScreeningQuestion rows. Replaces any prior requirements/questions (idempotent re-parse). */
export async function applyExtractionToJob(jobId: string, extraction: JobDescriptionExtraction) {
  await db.$transaction([
    db.jobRequirement.deleteMany({ where: { jobId } }),
    db.screeningQuestion.deleteMany({ where: { jobId } }),
    db.job.update({
      where: { id: jobId },
      data: {
        title: extraction.title,
        seniority: extraction.seniority,
        location: extraction.location,
        employmentType: extraction.employmentType,
        remotePolicy: extraction.remotePolicy,
        compensationMin: extraction.compensationMin,
        compensationMax: extraction.compensationMax,
        compensationCurrency: extraction.compensationCurrency,
        workAuthorizationRequirement: extraction.workAuthorizationRequirement,
        portfolioRequired: extraction.portfolioRequired,
        recruiterEmail: extraction.recruiterEmail,
        extractedData: extraction as never,
      },
    }),
    db.jobRequirement.createMany({
      data: extraction.requirements.map((r) => ({
        jobId,
        kind: r.kind,
        category: r.category,
        label: r.label,
        confidence: r.confidence,
      })),
    }),
    db.screeningQuestion.createMany({
      data: extraction.screeningQuestions.map((q, i) => ({
        jobId,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options as never,
        required: q.required,
        canonicalKey: q.canonicalKey === "NONE" ? null : q.canonicalKey,
        order: i,
      })),
    }),
  ]);
}
