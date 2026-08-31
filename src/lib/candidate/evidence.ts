import "server-only";
import { db } from "@/lib/db";
import { buildEvidenceItems, type EvidenceItem } from "@/lib/ai/matching";
import type { CandidateEvidenceForResume } from "@/lib/ai/resume-generation";

/** Single query point for "everything we know about this candidate" — used by both the deterministic matcher and resume generation, so they never drift out of sync. */
export async function loadCandidateEvidence(candidateProfileId: string) {
  const profile = await db.candidateProfile.findUniqueOrThrow({
    where: { id: candidateProfileId },
    include: {
      skills: { orderBy: { name: "asc" } },
      experiences: { where: { deletedAt: null }, orderBy: { startDate: "desc" } },
      projects: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { achievements: true } },
      certifications: { where: { deletedAt: null } },
      educations: { where: { deletedAt: null }, orderBy: { endDate: "desc" } },
    },
  });

  const evidenceItems: EvidenceItem[] = buildEvidenceItems({
    skills: profile.skills.map((s) => ({ id: s.id, name: s.name })),
    experiences: profile.experiences.map((e) => ({
      id: e.id,
      roleTitle: e.roleTitle,
      organizationName: e.organizationName,
      description: e.description,
    })),
    projects: profile.projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      technologies: p.technologies,
    })),
    certifications: profile.certifications.map((c) => ({ id: c.id, name: c.name })),
  });

  const experienceAchievements = await db.achievement.findMany({
    where: { experienceId: { in: profile.experiences.map((e) => e.id) } },
  });

  const resumeEvidence: CandidateEvidenceForResume = {
    headline: profile.headline,
    experiences: profile.experiences.map((e) => ({
      id: e.id,
      organizationName: e.organizationName,
      roleTitle: e.roleTitle,
      location: e.location,
      startDate: e.startDate.toISOString().slice(0, 10),
      endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
      isCurrent: e.isCurrent,
      description: e.description,
      achievements: experienceAchievements
        .filter((a) => a.experienceId === e.id)
        .map((a) => ({ description: a.description, metricValue: a.metricValue, metricUnit: a.metricUnit })),
    })),
    projects: profile.projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      technologies: p.technologies,
    })),
    educations: profile.educations.map((e) => ({
      id: e.id,
      institution: e.institution,
      degree: e.degree,
      fieldOfStudy: e.fieldOfStudy,
      endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
    })),
    skills: profile.skills.map((s) => s.name),
  };

  return { profile, evidenceItems, resumeEvidence };
}
