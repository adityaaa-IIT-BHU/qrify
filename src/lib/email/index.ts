import "server-only";
import type { EmailProvider } from "@/lib/email/interface";
import { ConsoleEmail } from "@/lib/email/console";
import { ResendEmail } from "@/lib/email/resend";

export type { EmailProvider, SendEmailInput } from "@/lib/email/interface";

let instance: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (instance) return instance;
  instance = process.env.RESEND_API_KEY ? new ResendEmail() : new ConsoleEmail();
  return instance;
}
