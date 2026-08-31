import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { userCanManageJob } from "@/lib/employer/access";
import { buildApplyUrl, renderQrPngDataUrl, renderQrSvg } from "@/lib/qr/generate";
import { recordAuditEvent } from "@/lib/audit";

const CreateQrSchema = z.object({ type: z.enum(["APPLY", "MESSAGE", "APPLY_INTRO"]).default("APPLY") });

export async function POST(request: NextRequest, ctx: RouteContext<"/api/jobs/[id]/qr">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: jobId } = await ctx.params;

  if (!(await userCanManageJob(user.id, jobId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const { type } = CreateQrSchema.parse(body);

  // The QR stays stable across job edits (docs/ARCHITECTURE.md § QR Architecture)
  // — reuse an existing non-revoked token of this type instead of minting a new one.
  let qrToken = await db.qRToken.findFirst({ where: { jobId, type, revoked: false } });
  if (!qrToken) {
    qrToken = await db.qRToken.create({ data: { jobId, type } });
  }

  await db.job.update({ where: { id: jobId }, data: { status: "ACTIVE" } });

  const applyUrl = buildApplyUrl(qrToken.id);
  const [pngDataUrl, svg] = await Promise.all([renderQrPngDataUrl(applyUrl), renderQrSvg(applyUrl)]);

  await recordAuditEvent({ actorUserId: user.id, action: "qr.generated", targetType: "QRToken", targetId: qrToken.id });

  return NextResponse.json({ qrTokenId: qrToken.id, applyUrl, pngDataUrl, svg });
}
