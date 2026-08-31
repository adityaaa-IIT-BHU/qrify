import "server-only";
import { db } from "@/lib/db";

export async function ensureCandidateProfile(userId: string) {
  const existing = await db.candidateProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.candidateProfile.create({
    data: { userId, consentPolicy: { create: { mode: "ONE_TAP" } } },
  });
}
