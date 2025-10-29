export type Mail = {
  to: string | string[];
  subject: string;
  body: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    mimeType?: string;
  }>;
};
