export type Mail = {
  to: string | string[];
  subject: string;
  body: {
    html: string;
    text: string;
  };
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string;
    mimeType?: string;
  }>;
};
