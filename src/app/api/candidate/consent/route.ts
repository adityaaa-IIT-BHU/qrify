import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCandidateProfile } from "@/lib/candidate/profile";
import { recordAuditEvent } from "@/lib/audit";

const ConsentSchema = z.object({ mode: z.enum(["REVIEW", "ONE_TAP", "INSTANT"]) });

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = ConsentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const profile = await ensureCandidateProfile(user.id);
  const policy = await db.consentPolicy.upsert({
    where: { candidateProfileId: profile.id },
    create: { candidateProfileId: profile.id, mode: parsed.data.mode },
    update: { mode: parsed.data.mode },
  });

  await recordAuditEvent({
    actorUserId: user.id,
    action: "consent.changed",
    targetType: "ConsentPolicy",
    targetId: policy.id,
    metadata: { mode: parsed.data.mode },
  });

  return NextResponse.json({ policy });
}
