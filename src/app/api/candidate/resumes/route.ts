import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCandidateProfile } from "@/lib/candidate/profile";
import { extractTextFromPdf } from "@/lib/pdf/extract-text";
import { extractCandidateFactsFromResume } from "@/lib/ai/profile-extraction";
import { applyCandidateExtraction } from "@/lib/candidate/apply-extraction";
import { getStorage } from "@/lib/storage";
import { recordAuditEvent } from "@/lib/audit";

const MAX_BYTES = 8 * 1024 * 1024;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ resumes: [] });

  const resumes = await db.resume.findMany({
    where: { candidateProfileId: profile.id, deletedAt: null },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ resumes });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const label = (formData?.get("label") as string | null) ?? "Uploaded resume";
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
  }

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isText = file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt");
  if (!isPdf && !isText) {
    return NextResponse.json({ error: "Only PDF or plain-text resumes are supported right now" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const resumeText = isPdf ? await extractTextFromPdf(buffer) : buffer.toString("utf8");
  if (resumeText.trim().length < 30) {
    return NextResponse.json({ error: "Couldn't read enough text from that file — try a different export." }, { status: 400 });
  }

  const profile = await ensureCandidateProfile(user.id);

  const source = await db.profileSource.create({
    data: { candidateProfileId: profile.id, type: "RESUME_UPLOAD", externalRef: file.name, lastSyncedAt: new Date() },
  });

  const existingCount = await db.resume.count({ where: { candidateProfileId: profile.id, deletedAt: null } });
  const resume = await db.resume.create({
    data: { candidateProfileId: profile.id, label, kind: existingCount === 0 ? "MASTER" : "UPLOADED" },
  });

  const storageKey = `resumes/${profile.id}/${resume.id}/v1${isPdf ? ".pdf" : ".txt"}`;
  await getStorage().putObject({ key: storageKey, body: buffer, contentType: isPdf ? "application/pdf" : "text/plain" });

  await db.resumeVersion.create({
    data: {
      resumeId: resume.id,
      versionNumber: 1,
      fileUrl: storageKey,
      fileType: isPdf ? "application/pdf" : "text/plain",
      isCurrent: true,
    },
  });

  let extraction;
  try {
    extraction = await extractCandidateFactsFromResume(resumeText);
    await applyCandidateExtraction(profile.id, source.id, extraction);
  } catch (err) {
    console.error("[resumes] extraction failed", err);
  }

  await recordAuditEvent({ actorUserId: user.id, action: "resume.uploaded", targetType: "Resume", targetId: resume.id });

  return NextResponse.json({ resume, extraction: extraction ?? null });
}
