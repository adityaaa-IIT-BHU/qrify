import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { extractCandidateFactsFromVoice } from "@/lib/ai/profile-extraction";
import { applyCandidateExtraction } from "@/lib/candidate/apply-extraction";
import { recordAuditEvent } from "@/lib/audit";

const TranscriptSchema = z.object({
  promptKey: z.string(),
  promptText: z.string(),
  rawText: z.string().trim().min(1).max(8000),
});

/** Appends one answered prompt's transcript to an in-progress voice session. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/candidate/voice/session/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const session = await db.voiceSession.findUnique({ where: { id }, include: { candidateProfile: true } });
  if (!session || session.candidateProfile.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = TranscriptSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const transcript = await db.transcript.create({ data: { voiceSessionId: id, ...parsed.data } });
  return NextResponse.json({ transcript });
}

/** Finishes the session: runs extraction across all collected transcripts and writes profile facts. */
export async function PATCH(_request: NextRequest, ctx: RouteContext<"/api/candidate/voice/session/[id]">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const session = await db.voiceSession.findUnique({
    where: { id },
    include: { candidateProfile: true, transcripts: true },
  });
  if (!session || session.candidateProfile.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (session.transcripts.length === 0) {
    return NextResponse.json({ error: "No answers recorded in this session" }, { status: 400 });
  }

  const source = await db.profileSource.create({
    data: { candidateProfileId: session.candidateProfileId, type: "VOICE", externalRef: session.id, lastSyncedAt: new Date() },
  });

  const extraction = await extractCandidateFactsFromVoice(
    session.transcripts.map((t) => ({ promptKey: t.promptKey, promptText: t.promptText, rawText: t.rawText })),
  );
  await applyCandidateExtraction(session.candidateProfileId, source.id, extraction);

  await db.voiceSession.update({ where: { id }, data: { status: "PROCESSED", completedAt: new Date() } });
  await recordAuditEvent({ actorUserId: user.id, action: "profile.voice_processed", targetType: "VoiceSession", targetId: id });

  return NextResponse.json({ extraction });
}
