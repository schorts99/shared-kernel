export type MailAddress = string | { name: string; email: string };

export type MailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

export interface Mail {
  from?: MailAddress;
  to: MailAddress | MailAddress[];
  cc?: MailAddress | MailAddress[];
  bcc?: MailAddress | MailAddress[];
  replyTo?: MailAddress;
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
  tags?: string[];
  metadata?: Record<string, string>;
}
