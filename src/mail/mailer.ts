import { Mail } from "./mail";

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class LoggingMailer implements Mailer {
  async send(mail: Mail): Promise<void> {
    console.log(`[LoggingMailer] Sending email: "${mail.subject}" to ${JSON.stringify(mail.to)}`);
  }
}
