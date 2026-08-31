import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ applications: [] });

  const applications = await db.application.findMany({
    where: { candidateProfileId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { job: { include: { employer: true } } },
  });

  return NextResponse.json({ applications });
}
