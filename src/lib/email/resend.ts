import "server-only";
import { Resend } from "resend";
import type { EmailProvider, SendEmailInput } from "@/lib/email/interface";

export class ResendEmail implements EmailProvider {
  private client: Resend;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not set");
    this.client = new Resend(key);
  }

  async send(input: SendEmailInput): Promise<void> {
    const from = process.env.EMAIL_FROM ?? "QRify <apply@qrify.app>";
    const { error } = await this.client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) throw new Error(`Resend send failed: ${error.message}`);
  }
}
