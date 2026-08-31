import "server-only";
import type { Job } from "@/generated/prisma/client";
import type { ApplicationProvider, DeliverInput, DeliverResult, MissingFieldsInput } from "@/lib/providers/types";

/**
 * The mandatory baseline provider. "Delivery" is a no-op beyond what
 * applications-service.ts already wrote to the database — the application
 * is immediately visible in the employer's QRify inbox (app/employer/jobs/[id]/applicants).
 * No ATS, no external account needed on the employer's side.
 */
export class QRifyNativeProvider implements ApplicationProvider {
  readonly type = "QRIFY_NATIVE" as const;
  readonly availability = "AVAILABLE" as const;

  canHandle(_job: Job): boolean {
    return true;
  }

  getMissingFields(input: MissingFieldsInput): string[] {
    const missing: string[] = [];
    if (!input.hasResume) missing.push("resume");
    for (const id of input.requiredScreeningQuestionIds) {
      if (!input.answeredQuestionIds.includes(id)) missing.push(`screening_question:${id}`);
    }
    return missing;
  }

  async deliver(_input: DeliverInput): Promise<DeliverResult> {
    return { success: true, externalRef: "qrify-inbox" };
  }
}
