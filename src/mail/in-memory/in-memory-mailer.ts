import { cloneValue } from "../../utils";
import { Mail, MailAddress } from "../mail";
import { Mailer } from "../mailer";

export interface SentMail extends Mail {
  sentAt: Date;
}

export class InMemoryMailer implements Mailer {
  private readonly sentMails: SentMail[] = [];

  async send(mail: Mail): Promise<void> {
    this.sentMails.push({
      ...cloneValue(mail),
      sentAt: new Date(),
    });
  }

  getSentMails(): SentMail[] {
    return this.sentMails.map(mail => cloneValue(mail));
  }

  getSentTo(email: string): SentMail[] {
    const normalized = email.toLowerCase();
    return this.sentMails
      .filter(mail =>
        this.matchesRecipient(mail.to, normalized) ||
        this.matchesRecipient(mail.cc, normalized) ||
        this.matchesRecipient(mail.bcc, normalized)
      )
      .map(mail => cloneValue(mail));
  }

  clear(): void {
    this.sentMails.length = 0;
  }

  private matchesRecipient(
    recipient: MailAddress | MailAddress[] | undefined,
    normalizedEmail: string
  ): boolean {
    if (!recipient) {
      return false;
    }

    const list = Array.isArray(recipient) ? recipient : [recipient];
    return list.some(item => {
      const address = typeof item === "string" ? item : item.email;
      return address.toLowerCase() === normalizedEmail;
    });
  }
}
