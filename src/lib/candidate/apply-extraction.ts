import "server-only";
import { db } from "@/lib/db";
import type { CandidateFactExtraction } from "@/lib/ai/schemas";

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Writes a CandidateFactExtraction (from resume or voice) onto the candidate's profile — new Experience/Education/Project/Skill/Certification rows plus a matching ProfileFact evidence-ledger entry for each, all attributed to the given ProfileSource. */
export async function applyCandidateExtraction(
  candidateProfileId: string,
  sourceId: string,
  extraction: CandidateFactExtraction,
) {
  if (extraction.headline) {
    await db.candidateProfile.updateMany({
      where: { id: candidateProfileId, headline: null },
      data: { headline: extraction.headline },
    });
  }

  for (const exp of extraction.experiences) {
    const startDate = parseDate(exp.startDate) ?? new Date();
    const experience = await db.experience.create({
      data: {
        candidateProfileId,
        organizationName: exp.organizationName,
        roleTitle: exp.roleTitle,
        location: exp.location,
        startDate,
        endDate: parseDate(exp.endDate),
        isCurrent: exp.isCurrent,
        description: exp.description,
        sourceId,
        confidence: exp.confidence,
      },
    });
    for (const a of exp.achievements) {
      await db.achievement.create({
        data: {
          candidateProfileId,
          experienceId: experience.id,
          description: a.description,
          metricValue: a.metricValue,
          metricUnit: a.metricUnit,
          sourceId,
          confidence: exp.confidence,
        },
      });
    }
    await db.profileFact.create({
      data: {
        candidateProfileId,
        sourceId,
        entityType: "experience",
        entityId: experience.id,
        factKey: "experience",
        factValue: exp as never,
        confidence: exp.confidence,
      },
    });
  }

  for (const edu of extraction.educations) {
    const education = await db.education.create({
      data: {
        candidateProfileId,
        institution: edu.institution,
        degree: edu.degree,
        fieldOfStudy: edu.fieldOfStudy,
        startDate: parseDate(edu.startDate),
        endDate: parseDate(edu.endDate),
        grade: edu.grade,
        sourceId,
        confidence: edu.confidence,
      },
    });
    await db.profileFact.create({
      data: {
        candidateProfileId,
        sourceId,
        entityType: "education",
        entityId: education.id,
        factKey: "education",
        factValue: edu as never,
        confidence: edu.confidence,
      },
    });
  }

  for (const proj of extraction.projects) {
    const project = await db.project.create({
      data: {
        candidateProfileId,
        name: proj.name,
        description: proj.description,
        url: proj.url,
        repoUrl: proj.repoUrl,
        technologies: proj.technologies,
        sourceId,
        confidence: proj.confidence,
      },
    });
    await db.profileFact.create({
      data: {
        candidateProfileId,
        sourceId,
        entityType: "project",
        entityId: project.id,
        factKey: "project",
        factValue: proj as never,
        confidence: proj.confidence,
      },
    });
  }

  for (const skill of extraction.skills) {
    const row = await db.skill.upsert({
      where: { candidateProfileId_name: { candidateProfileId, name: skill.name } },
      create: { candidateProfileId, name: skill.name, category: skill.category, sourceId, confidence: skill.confidence },
      update: { confidence: skill.confidence, sourceId },
    });
    await db.profileFact.create({
      data: {
        candidateProfileId,
        sourceId,
        entityType: "skill",
        entityId: row.id,
        factKey: "skill",
        factValue: skill as never,
        confidence: skill.confidence,
      },
    });
  }

  for (const cert of extraction.certifications) {
    const certification = await db.certification.create({
      data: {
        candidateProfileId,
        name: cert.name,
        issuer: cert.issuer,
        issueDate: parseDate(cert.issueDate),
        sourceId,
        confidence: cert.confidence,
      },
    });
    await db.profileFact.create({
      data: {
        candidateProfileId,
        sourceId,
        entityType: "certification",
        entityId: certification.id,
        factKey: "certification",
        factValue: cert as never,
        confidence: cert.confidence,
      },
    });
  }

  await recomputeProfileCompleteness(candidateProfileId);
}

export async function recomputeProfileCompleteness(candidateProfileId: string) {
  const [profile, experienceCount, skillCount, resumeCount] = await Promise.all([
    db.candidateProfile.findUniqueOrThrow({ where: { id: candidateProfileId } }),
    db.experience.count({ where: { candidateProfileId, deletedAt: null } }),
    db.skill.count({ where: { candidateProfileId } }),
    db.resume.count({ where: { candidateProfileId, deletedAt: null } }),
  ]);

  let score = 0;
  if (profile.headline) score += 15;
  if (profile.location) score += 10;
  if (experienceCount > 0) score += 25;
  if (skillCount >= 3) score += 20;
  if (resumeCount > 0) score += 20;
  if (profile.workAuthorization) score += 10;

  await db.candidateProfile.update({ where: { id: candidateProfileId }, data: { profileCompleteness: Math.min(100, score) } });
}
