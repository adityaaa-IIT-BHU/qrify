import "server-only";
import type { EmailProvider, SendEmailInput } from "@/lib/email/interface";

/** Dev fallback when RESEND_API_KEY is unset — logs instead of sending, so magic links/flows still work locally. */
export class ConsoleEmail implements EmailProvider {
  async send(input: SendEmailInput): Promise<void> {
    console.log(
      `\n[email:console] to=${input.to} subject="${input.subject}"\n${input.text ?? input.html}\n`,
    );
  }
}
