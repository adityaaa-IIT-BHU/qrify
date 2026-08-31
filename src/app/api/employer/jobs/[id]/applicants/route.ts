import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { userCanManageJob } from "@/lib/employer/access";

export async function GET(_request: Request, ctx: RouteContext<"/api/employer/jobs/[id]/applicants">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: jobId } = await ctx.params;

  if (!(await userCanManageJob(user.id, jobId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const applications = await db.application.findMany({
    where: { jobId, status: { in: ["SUBMITTED", "SHORTLISTED", "REJECTED"] } },
    orderBy: { submittedAt: "desc" },
    include: {
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
      answers: true,
    },
  });

  return NextResponse.json({ applications });
}
