export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<void>;
}
