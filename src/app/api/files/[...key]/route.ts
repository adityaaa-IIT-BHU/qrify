import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getStorage } from "@/lib/storage";

/**
 * Every file (resumes, generated PDFs) is served through this one
 * authenticated route — never a public storage URL (docs/SECURITY.md §
 * PII). Access is granted to: the candidate who owns the file, or an
 * employer member who has actually received it via a submitted application.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/files/[...key]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key: keyParts } = await ctx.params;
  const key = keyParts.join("/");

  const allowed = await canAccessFile(user.id, key);
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const object = await getStorage().getObjectBuffer(key);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(object.buffer), {
    headers: { "Content-Type": object.contentType, "Cache-Control": "private, max-age=60" },
  });
}

async function canAccessFile(userId: string, key: string): Promise<boolean> {
  if (key.startsWith("resumes/")) {
    const candidateProfileId = key.split("/")[1];
    const ownerProfile = await db.candidateProfile.findUnique({ where: { userId } });
    if (ownerProfile && ownerProfile.id === candidateProfileId) return true;

    // Employer member viewing a resume actually submitted to one of their jobs.
    const memberships = await db.employerMember.findMany({ where: { userId }, select: { employerId: true } });
    if (memberships.length === 0) return false;

    const artifact = await db.applicationArtifact.findFirst({
      where: {
        resumeVersion: { fileUrl: key },
        application: { job: { employerId: { in: memberships.map((m) => m.employerId) } } },
      },
    });
    return Boolean(artifact);
  }

  return false;
}
