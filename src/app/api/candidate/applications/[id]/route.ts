import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

/** "What exactly did QRify send?" — the immutable artifact/answer trail for one application. */
export async function GET(_request: Request, ctx: RouteContext<"/api/candidate/applications/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const application = await db.application.findUnique({
    where: { id },
    include: {
      candidateProfile: true,
      job: { include: { employer: true } },
      artifacts: { include: { resumeVersion: true } },
      answers: true,
      submissionAttempts: true,
    },
  });

  if (!application || application.candidateProfile.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ application });
}
