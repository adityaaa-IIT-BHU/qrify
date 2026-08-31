import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCandidateProfile } from "@/lib/candidate/profile";
import { recordAuditEvent } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    include: {
      skills: true,
      experiences: { where: { deletedAt: null }, orderBy: { startDate: "desc" } },
      educations: { where: { deletedAt: null } },
      projects: { where: { deletedAt: null } },
      certifications: { where: { deletedAt: null } },
      resumes: { where: { deletedAt: null }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } },
      sources: true,
      consentPolicy: true,
      preference: true,
    },
  });

  return NextResponse.json({ profile });
}

const UpdateProfileSchema = z.object({
  headline: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  remotePreference: z.enum(["REMOTE", "HYBRID", "ONSITE", "NO_PREFERENCE"]).optional(),
  salaryExpectationMin: z.number().int().nonnegative().nullable().optional(),
  salaryExpectationMax: z.number().int().nonnegative().nullable().optional(),
  noticePeriodDays: z.number().int().nonnegative().nullable().optional(),
  workAuthorization: z.string().trim().max(200).optional(),
  availability: z.string().trim().max(200).optional(),
  links: z
    .object({
      portfolio: z.string().url().optional(),
      personalWebsite: z.string().url().optional(),
      linkedinUrl: z.string().url().optional(),
      githubUsername: z.string().optional(),
    })
    .partial()
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const existing = await ensureCandidateProfile(user.id);
  const profile = await db.candidateProfile.update({ where: { id: existing.id }, data: parsed.data as never });

  await recordAuditEvent({ actorUserId: user.id, action: "profile.updated", targetType: "CandidateProfile", targetId: profile.id });

  return NextResponse.json({ profile });
}
