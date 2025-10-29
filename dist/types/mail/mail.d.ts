export type Mail = {
    to: string | string[];
    subject: string;
    body: {
        html: string;
        text: string;
    };
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string;
    attachments?: Array<{
        filename: string;
        content: string;
        mimeType?: string;
    }>;
};
//# sourceMappingURL=mail.d.ts.map