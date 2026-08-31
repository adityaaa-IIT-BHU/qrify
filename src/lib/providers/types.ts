import type { Job } from "@/generated/prisma/client";

/**
 * Application execution adapter interface (docs/ARCHITECTURE.md § Application
 * Execution Layer). Every provider answers: can I handle this job, what's
 * missing before I can submit, and how do I get the application to the
 * employer once QRify has already prepared it?
 *
 * QRifyNativeProvider is the only mandatory, always-on provider — every job
 * lands in the QRify employer inbox regardless of what else is enabled
 * (docs/PRODUCT_SPEC.md § Employer Experience for QRify-Native Jobs). The
 * others are additional delivery channels an employer can layer on top.
 */

export interface MissingFieldsInput {
  requiredScreeningQuestionIds: string[];
  answeredQuestionIds: string[];
  hasResume: boolean;
}

export interface DeliverInput {
  applicationId: string;
  job: Job;
  candidateName: string;
  candidateEmail: string;
  resumeBuffer: Buffer | null;
  resumeFileName: string;
  coverNote: string | null;
  answers: Array<{ questionText: string; answerText: string }>;
}

export interface DeliverResult {
  success: boolean;
  externalRef?: string;
  error?: string;
}

export type ProviderAvailability = "AVAILABLE" | "NOT_IMPLEMENTED";

export interface ApplicationProvider {
  readonly type:
    | "QRIFY_NATIVE"
    | "ATS_API"
    | "EMAIL"
    | "REDIRECT_PREFILL"
    | "BROWSER_ASSIST";
  readonly availability: ProviderAvailability;
  canHandle(job: Job): boolean;
  getMissingFields(input: MissingFieldsInput): string[];
  deliver(input: DeliverInput): Promise<DeliverResult>;
}
