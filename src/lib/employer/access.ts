import "server-only";
import { db } from "@/lib/db";

/** Gets the user's employer (creating one on first use — no separate "create company" step needed for MVP). */
export async function ensureEmployerForUser(userId: string, companyName: string) {
  const existingMembership = await db.employerMember.findFirst({
    where: { userId },
    include: { employer: true },
  });
  if (existingMembership) return existingMembership.employer;

  const employer = await db.employer.create({
    data: {
      name: companyName,
      members: { create: { userId, role: "OWNER", joinedAt: new Date() } },
    },
  });
  return employer;
}

/** Throws-free access check: does this user belong to the employer that owns this job? */
export async function userCanManageJob(userId: string, jobId: string): Promise<boolean> {
  const job = await db.job.findUnique({ where: { id: jobId }, select: { employerId: true } });
  if (!job) return false;
  const membership = await db.employerMember.findUnique({
    where: { employerId_userId: { employerId: job.employerId, userId } },
  });
  return Boolean(membership);
}
