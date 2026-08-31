import "server-only";
import { extractStructured } from "@/lib/ai/client";
import { CandidateFactExtractionSchema, type CandidateFactExtraction } from "@/lib/ai/schemas";

const GROUNDING_RULES = `You extract structured career facts from a candidate-provided source (resume text or a voice-interview transcript). You NEVER invent facts.

Hard rules — violating any of these is a critical failure:
- Every experience, education entry, project, skill, achievement, and certification you output MUST be explicitly stated or very directly implied by the source text. If it is not in the text, do not include it.
- Do not infer years of experience, seniority, or skill proficiency beyond what the text supports. "Used Python for a class project" is not "3 years Python experience."
- Do not infer employment dates you cannot find; use null rather than guessing a date.
- Do not embellish achievements with metrics that are not stated (never invent a percentage, dollar amount, or scale that the candidate didn't say).
- Give every entry a confidence in [0,1]. Use lower confidence (< 0.6) for anything paraphrased, ambiguous, or reconstructed from informal speech (voice transcripts) rather than quoted directly.
- If the source contains a claim that sounds unusual or hard to verify (e.g. an extreme metric), extract it as stated but keep confidence moderate — do not silently "clean it up" into something stronger or weaker.
- Do not infer or record protected characteristics (age, gender, religion, ethnicity, marital/family status, disability) even if mentioned — omit them entirely; they are never used for candidate evaluation.`;

export async function extractCandidateFactsFromResume(resumeText: string): Promise<CandidateFactExtraction> {
  return extractStructured({
    system: `${GROUNDING_RULES}\n\nSource type: resume document (parsed to plain text).`,
    untrustedInput: resumeText,
    schema: CandidateFactExtractionSchema,
    effort: "medium",
    maxTokens: 8000,
  });
}

export interface VoiceTranscriptInput {
  promptKey: string;
  promptText: string;
  rawText: string;
}

export async function extractCandidateFactsFromVoice(
  transcripts: VoiceTranscriptInput[],
): Promise<CandidateFactExtraction> {
  const formatted = transcripts
    .map((t) => `Q (${t.promptKey}): ${t.promptText}\nA: ${t.rawText}`)
    .join("\n\n");

  return extractStructured({
    system: `${GROUNDING_RULES}\n\nSource type: transcript of the candidate speaking naturally in response to interview-style prompts. Speech is informal — extract the underlying facts, not the phrasing. Lower confidence for anything vague ("worked on some backend stuff") vs. specific ("built the payments service in Go").`,
    untrustedInput: formatted,
    schema: CandidateFactExtractionSchema,
    effort: "medium",
    maxTokens: 8000,
  });
}
