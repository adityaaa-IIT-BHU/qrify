import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { userCanManageJob } from "@/lib/employer/access";
import { recordAuditEvent } from "@/lib/audit";

const StatusSchema = z.object({
  status: z.enum(["SHORTLISTED", "REJECTED"]),
  note: z.string().trim().max(2000).optional(),
});

/** Employer-side shortlist/reject action. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/applications/[id]/status">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const application = await db.application.findUnique({ where: { id } });
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await userCanManageJob(user.id, application.jobId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await db.application.update({
    where: { id },
    data: { status: parsed.data.status, recruiterNote: parsed.data.note },
  });

  await recordAuditEvent({
    actorUserId: user.id,
    actorType: "EMPLOYER",
    action: `application.${parsed.data.status.toLowerCase()}`,
    targetType: "Application",
    targetId: id,
  });

  return NextResponse.json({ application: updated });
}
