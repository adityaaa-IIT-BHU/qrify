import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCandidateProfile } from "@/lib/candidate/profile";
import { decryptSecret } from "@/lib/crypto";
import { fetchGithubSyncData } from "@/lib/integrations/github-sync";
import { applyCandidateExtraction } from "@/lib/candidate/apply-extraction";
import { recordAuditEvent } from "@/lib/audit";
import type { CandidateFactExtraction } from "@/lib/ai/schemas";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connection = await db.oAuthConnection.findFirst({ where: { userId: user.id, provider: "GITHUB" } });
  if (!connection) {
    return NextResponse.json({ error: "Connect GitHub first (sign in with GitHub, or link it from settings)" }, { status: 400 });
  }

  const profile = await ensureCandidateProfile(user.id);
  const accessToken = decryptSecret(connection.accessTokenEnc);
  const data = await fetchGithubSyncData(accessToken);

  const existingSource = await db.profileSource.findFirst({ where: { candidateProfileId: profile.id, type: "GITHUB" } });
  const source = existingSource
    ? await db.profileSource.update({ where: { id: existingSource.id }, data: { lastSyncedAt: new Date() } })
    : await db.profileSource.create({
        data: { candidateProfileId: profile.id, type: "GITHUB", externalRef: connection.providerAccountId, lastSyncedAt: new Date() },
      });

  const extraction: CandidateFactExtraction = {
    headline: null,
    experiences: [],
    educations: [],
    projects: data.projects.map((p) => ({
      name: p.name,
      description: p.description,
      url: p.url,
      repoUrl: p.repoUrl,
      technologies: p.technologies,
      confidence: 1,
    })),
    skills: data.languageSkills.map((name) => ({ name, category: "language", confidence: 1 })),
    certifications: [],
    notes: data.bio,
  };

  await applyCandidateExtraction(profile.id, source.id, extraction);
  await db.oAuthConnection.update({ where: { id: connection.id }, data: { lastSyncedAt: new Date() } });
  await recordAuditEvent({ actorUserId: user.id, action: "profile.github_synced" });

  return NextResponse.json({ projectsAdded: data.projects.length, skillsAdded: data.languageSkills.length });
}
