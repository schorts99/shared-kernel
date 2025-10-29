export type Mail = {
    to: string | string[];
    subject: string;
    body: {
        html: string;
        text: string;
    };
    from?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: Array<{
        filename: string;
        content: string;
        mimeType?: string;
    }>;
};
//# sourceMappingURL=mail.d.ts.map