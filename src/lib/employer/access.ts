import "server-only";
import { db } from "@/lib/db";

/** Gets the user's employer (creating one on first use — no separate "create company" step needed for MVP). */
export async function ensureEmployerForUser(userId: string, companyName: string) {
  const existingMembership = await db.employerMember.findFirst({
    where: { userId },
    include: { employer: true },
  });
  if (existingMembership) return existingMembership.employer;

  // If the creating user already has a verified email (magic-link/OAuth
  // signup, or a password account that's since verified), there's no
  // reason to make them jump through email verification again before their
  // first job can go live — see docs/PRIVACY.md / SECURITY.md § employer
  // verification.
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  const employer = await db.employer.create({
    data: {
      name: companyName,
      verifiedStatus: user.emailVerifiedAt ? "EMAIL_VERIFIED" : "UNVERIFIED",
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
