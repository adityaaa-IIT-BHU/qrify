import "server-only";
import { extractStructured } from "@/lib/ai/client";
import { MatchExplanationSchema, type MatchExplanation } from "@/lib/ai/schemas";
import type { MatchResult } from "@/lib/ai/matching";

/**
 * Turns the deterministic MatchResult (src/lib/ai/matching.ts) into a
 * recruiter-facing narrative. Runs async, after application submission —
 * never on the candidate's scan -> apply path. Grounded strictly in the
 * matched evidence the deterministic matcher already found; the model is
 * not asked to find new matches, only to explain existing ones in prose.
 */
export async function generateMatchExplanation(match: MatchResult): Promise<MatchExplanation> {
  const payload = JSON.stringify(
    {
      score: match.score,
      matched: match.matches
        .filter((m) => m.matched)
        .map((m) => ({ requirement: m.label, kind: m.kind, evidence: m.matchedEvidence.map((e) => e.label) })),
      gaps: match.gaps.map((g) => g.label),
    },
    null,
    2,
  );

  return extractStructured({
    system: `You write short, recruiter-facing explanations of why a candidate matched a job. You are given a pre-computed, already-verified list of matched requirements and their supporting evidence — do not add requirements or evidence that isn't in the input. Just explain it clearly and concisely. If gaps is non-empty, mention it plainly rather than glossing over it.`,
    untrustedInput: payload,
    schema: MatchExplanationSchema,
    effort: "low",
    maxTokens: 2000,
  });
}
