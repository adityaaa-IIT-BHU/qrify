import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { userCanManageJob } from "@/lib/employer/access";
import { recordAuditEvent } from "@/lib/audit";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/jobs/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  if (!(await userCanManageJob(user.id, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const job = await db.job.findUnique({
    where: { id },
    include: {
      requirements: true,
      screeningQuestions: { orderBy: { order: "asc" } },
      qrTokens: true,
      employer: true,
      _count: { select: { applications: true } },
    },
  });
  return NextResponse.json({ job });
}

const UpdateJobSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  compensationMin: z.number().int().nonnegative().nullable().optional(),
  compensationMax: z.number().int().nonnegative().nullable().optional(),
  compensationCurrency: z.string().trim().max(10).nullable().optional(),
  recruiterEmail: z.string().trim().email().nullable().optional(),
  applicationDeadline: z.string().datetime().nullable().optional(),
  workAuthorizationRequirement: z.string().trim().max(500).nullable().optional(),
  portfolioRequired: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "CLOSED"]).optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/jobs/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  if (!(await userCanManageJob(user.id, id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = UpdateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { applicationDeadline, ...rest } = parsed.data;
  const job = await db.job.update({
    where: { id },
    data: {
      ...rest,
      ...(applicationDeadline !== undefined
        ? { applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null }
        : {}),
    },
  });

  await recordAuditEvent({ actorUserId: user.id, action: "job.updated", targetType: "Job", targetId: id, metadata: parsed.data });

  return NextResponse.json({ job });
}
