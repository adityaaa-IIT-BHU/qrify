import "server-only";
import { extractStructured } from "@/lib/ai/client";
import { ScreeningAnswerDraftSchema, type ScreeningAnswerDraft } from "@/lib/ai/schemas";

export interface VaultAnswer {
  questionKey: string;
  answerText: string;
  approvedForReuse: boolean;
}

export interface ScreeningQuestionLike {
  id: string;
  questionText: string;
  canonicalKey: string | null;
  required: boolean;
}

/**
 * Deterministic, instant vault lookup — this is what runs on the candidate's
 * scan -> apply hot path for ONE_TAP/INSTANT modes. No LLM call, no latency.
 * A question only resolves here if it has a recognized canonicalKey AND the
 * candidate has previously approved that answer for reuse (consent-by-action
 * — see docs/PRIVACY.md § Consent Model).
 */
export function resolveVaultAnswer(
  question: ScreeningQuestionLike,
  vault: VaultAnswer[],
): { answerText: string; source: "AUTOFILLED_KNOWN" } | null {
  if (!question.canonicalKey || question.canonicalKey === "NONE") return null;
  const hit = vault.find((v) => v.questionKey === question.canonicalKey && v.approvedForReuse);
  if (!hit) return null;
  return { answerText: hit.answerText, source: "AUTOFILLED_KNOWN" };
}

/**
 * LLM-drafted answer for a question the vault can't resolve. Explicitly
 * OFF the hot path — triggered during a REVIEW-mode application, or when a
 * candidate proactively fills gaps in their profile. The draft always
 * requires candidate approval before being saved to the vault or submitted
 * (docs/PRODUCT_SPEC.md § Application Questions) — the flywheel: today's
 * REVIEW answer becomes tomorrow's INSTANT vault hit for the same
 * canonicalKey, but never silently.
 */
export async function draftScreeningAnswer(
  question: ScreeningQuestionLike,
  evidenceSummary: string,
): Promise<ScreeningAnswerDraft> {
  const payload = JSON.stringify(
    { question: question.questionText, candidateEvidenceSummary: evidenceSummary },
    null,
    2,
  );

  return extractStructured({
    system: `You draft a candidate's answer to a job application screening question, grounded only in their provided evidence summary. If the evidence doesn't contain enough information to answer truthfully and specifically, write a short, honest, generic answer and set needsCandidateReview to true rather than inventing specifics. Set needsCandidateReview to true for any subjective question (motivation, salary, availability) even if you can draft something reasonable — the candidate must confirm subjective answers before they're reused elsewhere.`,
    untrustedInput: payload,
    schema: ScreeningAnswerDraftSchema,
    effort: "low",
    maxTokens: 1500,
  });
}
