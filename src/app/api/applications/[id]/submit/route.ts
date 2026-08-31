import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { submitApplication } from "@/lib/applications/service";

export async function POST(_request: Request, ctx: RouteContext<"/api/applications/[id]/submit">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const application = await db.application.findUnique({
    where: { id },
    include: { candidateProfile: true },
  });
  if (!application || application.candidateProfile.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (application.status === "AWAITING_REVIEW") {
    return NextResponse.json(
      { error: "This application still has required questions to answer before it can be submitted." },
      { status: 409 },
    );
  }

  const result = await submitApplication(id);
  return NextResponse.json(result);
}
