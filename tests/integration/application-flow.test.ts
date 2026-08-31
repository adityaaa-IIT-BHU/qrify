import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { prepareApplication, submitApplication } from "@/lib/applications/service";
import { getStorage } from "@/lib/storage";

/**
 * Exercises the real scan -> prepare -> submit pipeline against a real
 * database (the local dev Postgres — see docker-compose.yml / README).
 * Requires DATABASE_URL, ENCRYPTION_KEY, QR_TOKEN_SECRET, IP_HASH_SALT to be
 * set (tests/setup.ts loads .env). Creates its own isolated fixtures and
 * tears them down — does not depend on scripts/seed-demo.ts having run.
 */
describe("application prepare -> submit flow", () => {
  const marker = `test-${Date.now()}`;
  let candidateProfileId: string;
  let jobId: string;
  let userId: string;
  let employerId: string;

  beforeAll(async () => {
    const user = await db.user.create({
      data: { email: `${marker}@example.test`, name: "Test Candidate", passwordHash: "unused" },
    });
    userId = user.id;

    const profile = await db.candidateProfile.create({
      data: { userId: user.id, headline: "Test Engineer", consentPolicy: { create: { mode: "ONE_TAP" } } },
    });
    candidateProfileId = profile.id;

    const source = await db.profileSource.create({
      data: { candidateProfileId: profile.id, type: "MANUAL" },
    });

    await db.skill.create({
      data: { candidateProfileId: profile.id, name: "TypeScript", sourceId: source.id, confidence: 1 },
    });

    const resume = await db.resume.create({
      data: { candidateProfileId: profile.id, label: "Master resume", kind: "MASTER" },
    });
    const storageKey = `resumes/${profile.id}/${resume.id}/v1.txt`;
    await getStorage().putObject({ key: storageKey, body: Buffer.from("Test resume content"), contentType: "text/plain" });
    await db.resumeVersion.create({
      data: { resumeId: resume.id, versionNumber: 1, fileUrl: storageKey, fileType: "text/plain", isCurrent: true },
    });

    const employer = await db.employer.create({ data: { name: `${marker}-employer` } });
    employerId = employer.id;

    const job = await db.job.create({
      data: {
        employerId: employer.id,
        createdById: user.id,
        title: "Test Role",
        rawDescription: "Needs TypeScript.",
        status: "ACTIVE",
        requirements: {
          create: [{ kind: "MUST_HAVE", category: "SKILL", label: "TypeScript", confidence: 1 }],
        },
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    // Cascade deletes handle most children (onDelete: Cascade throughout the schema).
    await db.job.delete({ where: { id: jobId } }).catch(() => {});
    await db.employer.delete({ where: { id: employerId } }).catch(() => {});
    await db.user.delete({ where: { id: userId } }).catch(() => {});
    await db.$disconnect();
  });

  it("prepares an application with a 100% match and a resume ready to send", async () => {
    const result = await prepareApplication(candidateProfileId, jobId);
    expect(result.matchResult.score).toBe(100);
    expect(result.hasResume).toBe(true);
    expect(result.eligibleForFastApply).toBe(true);
    expect(result.missingRequiredQuestionIds).toHaveLength(0);
  });

  it("submits the application and marks it SUBMITTED via the native provider", async () => {
    const prepared = await prepareApplication(candidateProfileId, jobId);
    const result = await submitApplication(prepared.applicationId);

    expect(result.application.status).toBe("SUBMITTED");
    expect(result.deliveries.find((d) => d.providerType === "QRIFY_NATIVE")?.success).toBe(true);

    const stored = await db.application.findUniqueOrThrow({ where: { id: prepared.applicationId } });
    expect(stored.submittedAt).not.toBeNull();
  });

  it("blocks fast-apply when a required screening question has no vault answer", async () => {
    const question = await db.screeningQuestion.create({
      data: { jobId, questionText: "Are you willing to relocate?", required: true, order: 0 },
    });

    const result = await prepareApplication(candidateProfileId, jobId);
    expect(result.eligibleForFastApply).toBe(false);
    expect(result.missingRequiredQuestionIds).toContain(question.id);

    await db.screeningQuestion.delete({ where: { id: question.id } });
  });
});
