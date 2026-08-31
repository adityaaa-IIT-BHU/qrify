import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureEmployerForUser } from "@/lib/employer/access";
import { extractJobDescription } from "@/lib/ai/jd-extraction";
import { applyExtractionToJob } from "@/lib/employer/job-extraction";
import { recordAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

const CreateJobSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  rawDescription: z.string().trim().min(30).max(20000),
});

// Employer flow: paste JD -> AI parses it immediately -> employer reviews/edits (PATCH) -> generates QR.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`jobs:create:${user.id}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many jobs created recently" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const employer = await ensureEmployerForUser(user.id, parsed.data.companyName);

  const job = await db.job.create({
    data: {
      employerId: employer.id,
      title: "Untitled role",
      rawDescription: parsed.data.rawDescription,
      status: "DRAFT",
      createdById: user.id,
    },
  });

  try {
    const extraction = await extractJobDescription(parsed.data.rawDescription);
    await applyExtractionToJob(job.id, extraction);
  } catch (err) {
    console.error("[jobs] JD extraction failed", err);
    return NextResponse.json(
      { jobId: job.id, warning: "AI parsing failed — you can still edit the job manually.", error: String(err) },
      { status: 207 },
    );
  }

  await recordAuditEvent({ actorUserId: user.id, action: "job.created", targetType: "Job", targetId: job.id });

  const full = await db.job.findUnique({
    where: { id: job.id },
    include: { requirements: true, screeningQuestions: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ job: full });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await db.employerMember.findMany({ where: { userId: user.id }, select: { employerId: true } });
  const employerIds = memberships.map((m) => m.employerId);

  const jobs = await db.job.findMany({
    where: { employerId: { in: employerIds }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  return NextResponse.json({ jobs });
}
