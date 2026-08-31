import "server-only";
import { db } from "@/lib/db";
import { loadCandidateEvidence } from "@/lib/candidate/evidence";
import { generateTailoredResume, type TargetJobForResume } from "@/lib/ai/resume-generation";
import { checkResumeFactuality } from "@/lib/ai/factuality";
import { renderResumePdf } from "@/lib/pdf/resume-pdf";
import { getStorage } from "@/lib/storage";
import type { JobDescriptionExtraction } from "@/lib/ai/schemas";

/**
 * Generates (or regenerates) a job-tailored resume: LLM generation ->
 * independent factuality check -> PDF render -> storage -> new
 * ResumeVersion row. Deliberately NOT on the candidate's scan -> apply hot
 * path — see docs/ARCHITECTURE.md § The Five-Second Application for why.
 * Callers: an explicit "Generate tailored resume" action, or a REVIEW-mode
 * application's prepare step.
 */
export async function generateAndStoreTailoredResume(candidateProfileId: string, jobId: string) {
  const [job, { profile, resumeEvidence }] = await Promise.all([
    db.job.findUniqueOrThrow({ where: { id: jobId } }),
    loadCandidateEvidence(candidateProfileId),
  ]);

  const extracted = job.extractedData as JobDescriptionExtraction | null;
  const targetJob: TargetJobForResume = {
    title: job.title,
    companyName: (await db.employer.findUnique({ where: { id: job.employerId } }))?.name ?? "the company",
    summary: extracted?.summary ?? job.rawDescription.slice(0, 500),
    mustHaveRequirements: extracted?.requirements.filter((r) => r.kind === "MUST_HAVE").map((r) => r.label) ?? [],
    niceToHaveRequirements:
      extracted?.requirements.filter((r) => r.kind === "NICE_TO_HAVE").map((r) => r.label) ?? [],
  };

  const content = await generateTailoredResume(resumeEvidence, targetJob);
  const factuality = await checkResumeFactuality(content, resumeEvidence);

  const user = await db.user.findUniqueOrThrow({ where: { id: profile.userId } });

  const pdfBuffer = await renderResumePdf(content, {
    name: user.name ?? user.email,
    email: user.email,
    phone: profile.phone,
    location: profile.location,
    links: profile.links as never,
  });

  let resume = await db.resume.findFirst({
    where: { candidateProfileId, kind: "TAILORED", versions: { some: { generatedForJobId: jobId } } },
  });
  if (!resume) {
    resume = await db.resume.create({
      data: { candidateProfileId, label: `${job.title} (tailored)`, kind: "TAILORED" },
    });
  }

  const lastVersion = await db.resumeVersion.findFirst({
    where: { resumeId: resume.id },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

  const storageKey = `resumes/${candidateProfileId}/${resume.id}/v${versionNumber}.pdf`;
  await getStorage().putObject({ key: storageKey, body: pdfBuffer, contentType: "application/pdf" });

  await db.resumeVersion.updateMany({ where: { resumeId: resume.id }, data: { isCurrent: false } });

  const version = await db.resumeVersion.create({
    data: {
      resumeId: resume.id,
      versionNumber,
      fileUrl: storageKey,
      fileType: "application/pdf",
      parsedContent: { content, factuality } as never,
      generatedForJobId: jobId,
      isCurrent: true,
    },
  });

  return { resume, version, content, factuality };
}
