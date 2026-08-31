import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser, getRequestIp } from "@/lib/auth/session";
import { resolveQrForRequest } from "@/lib/qr/resolve";
import { prepareApplication } from "@/lib/applications/service";

const PrepareSchema = z.object({ qrToken: z.string().min(1).max(500) });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = PrepareSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const user = await getCurrentUser();
  const resolved = await resolveQrForRequest(parsed.data.qrToken, {
    ip: (await getRequestIp()) ?? "unknown",
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
    resolvedCandidateUserId: user?.id,
  });

  if (!resolved.ok) {
    const status = resolved.reason === "rate_limited" ? 429 : resolved.reason === "invalid_qr" ? 404 : 410;
    return NextResponse.json({ error: resolved.reason }, { status });
  }

  if (!user) {
    return NextResponse.json({ status: "AUTH_REQUIRED", job: { title: resolved.job.title } });
  }

  const candidateProfile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!candidateProfile) {
    return NextResponse.json({ status: "PROFILE_REQUIRED", job: { title: resolved.job.title } });
  }

  const result = await prepareApplication(candidateProfile.id, resolved.job.id);
  return NextResponse.json({ status: "READY", ...result });
}
