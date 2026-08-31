import "server-only";
import { extractStructured } from "@/lib/ai/client";
import { OutreachMessageSchema, type OutreachMessage } from "@/lib/ai/schemas";

/**
 * Drafts the recruiter-outreach message for MESSAGE / APPLY_INTRO QR codes
 * (docs/PRODUCT_SPEC.md § Role-Specific DM). This ALWAYS produces a draft
 * for the candidate to review, edit, or copy — QRify never sends a message
 * on a candidate's behalf without an explicit SEND action, and never
 * pretends to automate LinkedIn DM delivery (unsupported by LinkedIn's
 * API — see docs/RESEARCH.md). The candidate's own client sends it via
 * email or a copy-to-clipboard deep link.
 */
export async function draftOutreachMessage(
  candidateEvidenceSummary: string,
  jobTitle: string,
  companyName: string,
  jobSummary: string,
): Promise<OutreachMessage> {
  const payload = JSON.stringify(
    { candidateEvidenceSummary, jobTitle, companyName, jobSummary },
    null,
    2,
  );

  return extractStructured({
    system: `You draft a short, specific, non-generic outreach message from a candidate to a recruiter about a role. Reference 1-2 concrete, real pieces of the candidate's evidence (a specific project, technology, or achievement) — never generic flattery ("I'm passionate about your mission"). Keep it under 120 words. Sign off simply; do not invent a candidate name or contact details.`,
    untrustedInput: payload,
    schema: OutreachMessageSchema,
    effort: "low",
    maxTokens: 1500,
  });
}
