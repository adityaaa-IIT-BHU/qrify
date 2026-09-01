import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { recordAuditEvent } from "@/lib/audit";

/**
 * Full data export — every profile fact, resume metadata, and application
 * QRify holds for this candidate, as one JSON file. Data-portability right
 * under DPDP/GDPR (see docs/PRIVACY.md) — everything here is already
 * structured, so this is a direct dump, not a reconstruction.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    include: {
      skills: true,
      experiences: { include: { achievements: true } },
      educations: true,
      projects: true,
      certifications: true,
      portfolioItems: true,
      publications: true,
      preference: true,
      consentPolicy: true,
      sources: true,
      resumes: { include: { versions: { select: { versionNumber: true, fileType: true, generatedForJobId: true, isCurrent: true, createdAt: true } } } },
      answers: true,
    },
  });

  const applications = profile
    ? await db.application.findMany({
        where: { candidateProfileId: profile.id },
        include: { job: { select: { title: true } }, answers: true },
      })
    : [];

  await recordAuditEvent({ actorUserId: user.id, action: "profile.exported" });

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, name: user.name, createdAt: user.createdAt },
    profile,
    applications,
  };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="qrify-profile-export.json"`,
    },
  });
}
