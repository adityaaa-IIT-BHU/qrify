import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

/** Cross-job applicant inbox — the "APPLICANTS" top-level nav item. Per-job view is at /employer/jobs/[id]. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.employerMember.findMany({ where: { userId: user.id }, select: { employerId: true } });
  const employerIds = memberships.map((m) => m.employerId);

  const applications = await db.application.findMany({
    where: { job: { employerId: { in: employerIds } }, status: { in: ["SUBMITTED", "SHORTLISTED", "REJECTED"] } },
    orderBy: { submittedAt: "desc" },
    include: {
      job: { select: { id: true, title: true } },
      candidateProfile: {
        select: {
          id: true,
          headline: true,
          location: true,
          links: true,
          user: { select: { name: true, email: true, image: true } },
        },
      },
      artifacts: true,
    },
  });

  return NextResponse.json({ applications });
}
