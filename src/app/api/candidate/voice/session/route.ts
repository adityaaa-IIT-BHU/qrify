import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureCandidateProfile } from "@/lib/candidate/profile";

export const VOICE_PROMPTS: Array<{ key: string; text: string }> = [
  { key: "current_role", text: "Tell me about your current role — what do you actually do day to day?" },
  { key: "biggest_build", text: "What's something real you built or shipped that you're proud of?" },
  { key: "impact", text: "What impact did that have — on users, the team, or the business?" },
  { key: "technologies", text: "What technologies or tools did you use for that?" },
  { key: "target_roles", text: "What kinds of roles are you targeting next?" },
  { key: "hidden_gem", text: "What's something important about you that doesn't show up on a resume?" },
  { key: "companies", text: "What kind of companies or teams interest you most, and why?" },
];

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await ensureCandidateProfile(user.id);
  const session = await db.voiceSession.create({ data: { candidateProfileId: profile.id } });
  return NextResponse.json({ session, prompts: VOICE_PROMPTS });
}
