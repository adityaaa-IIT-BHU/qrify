import "server-only";
import type { Job } from "@/generated/prisma/client";
import { getEmailProvider } from "@/lib/email";
import type { ApplicationProvider, DeliverInput, DeliverResult, MissingFieldsInput } from "@/lib/providers/types";

/**
 * Supplementary delivery channel: emails the employer's designated
 * recruiterEmail with a structured summary when a job has one configured.
 * Runs IN ADDITION to QRifyNativeProvider, never instead of it — the
 * application record and resume file remain the source of truth in QRify.
 */
export class EmailApplicationProvider implements ApplicationProvider {
  readonly type = "EMAIL" as const;
  readonly availability = "AVAILABLE" as const;

  canHandle(job: Job): boolean {
    return Boolean(job.recruiterEmail);
  }

  getMissingFields(input: MissingFieldsInput): string[] {
    return input.hasResume ? [] : ["resume"];
  }

  async deliver(input: DeliverInput): Promise<DeliverResult> {
    if (!input.job.recruiterEmail) {
      return { success: false, error: "No recruiterEmail configured on this job" };
    }

    const answersHtml = input.answers
      .map((a) => `<p><strong>${escapeHtml(a.questionText)}</strong><br/>${escapeHtml(a.answerText)}</p>`)
      .join("");

    const html = `
      <h2>New application: ${escapeHtml(input.job.title)}</h2>
      <p><strong>${escapeHtml(input.candidateName)}</strong> (${escapeHtml(input.candidateEmail)})</p>
      ${input.coverNote ? `<p>${escapeHtml(input.coverNote)}</p>` : ""}
      ${answersHtml}
      <p>Full application, resume, and matched evidence: view it in your <a href="${process.env.APP_URL}/employer/jobs/${input.job.id}/applicants">QRify applicant inbox</a>.</p>
    `;

    try {
      await getEmailProvider().send({
        to: input.job.recruiterEmail,
        subject: `New QRify application: ${input.candidateName} — ${input.job.title}`,
        html,
      });
      return { success: true, externalRef: input.job.recruiterEmail };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "email send failed" };
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
