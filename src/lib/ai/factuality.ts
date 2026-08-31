import "server-only";
import { extractStructured } from "@/lib/ai/client";
import { FactualityCheckSchema, type FactualityCheck } from "@/lib/ai/schemas";
import type { ResumeContent } from "@/lib/ai/schemas";
import type { CandidateEvidenceForResume } from "@/lib/ai/resume-generation";

/**
 * Independent second pass: given the ORIGINAL evidence and the GENERATED
 * resume content, checks every claim in the resume is grounded. This is
 * deliberately a separate model call from generation (docs/AI_SYSTEM.md §
 * Factuality Check) — asking the same call that wrote the claim to also
 * grade itself is a weaker check than a fresh pass whose only job is
 * verification.
 *
 * Callers (src/lib/providers/qrify-native.provider.ts) MUST treat
 * `overallPass: false` as blocking for INSTANT/ONE_TAP consent modes —
 * fall back to REVIEW so a human sees the flagged claim before it ships.
 */
export async function checkResumeFactuality(
  resume: ResumeContent,
  evidence: CandidateEvidenceForResume,
): Promise<FactualityCheck> {
  const payload = JSON.stringify({ generatedResume: resume, originalEvidence: evidence }, null, 2);

  return extractStructured({
    system: `You are a strict fact-checker. You are given "originalEvidence" (verified candidate data) and "generatedResume" (an AI-generated resume meant to be derived from it). For every bullet, summary sentence, and skill in generatedResume, verify it is directly supported by originalEvidence.

- "grounded": directly supported by the original evidence, even if reworded.
- "unsupported": claims something not present anywhere in the original evidence.
- "exaggerated": has a basis in the evidence but overstates it (e.g. evidence says "helped launch a feature", resume says "led the launch of a major product").

Be strict. When in doubt between grounded and exaggerated, prefer exaggerated. overallPass must be false if any claim is unsupported or exaggerated.`,
    untrustedInput: payload,
    schema: FactualityCheckSchema,
    effort: "medium",
    maxTokens: 6000,
  });
}
