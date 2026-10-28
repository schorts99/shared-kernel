import { Mail } from "./mail";
import { ConsoleLogger, type Logger } from "../logger";

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class LoggingMailer implements Mailer {
  private readonly logger: Logger;

  constructor(logger: Logger = new ConsoleLogger()) {
    this.logger = logger;
  }

  async send(mail: Mail): Promise<void> {
    this.logger.info(`Sending email: "${mail.subject}"`, {
      subject: mail.subject,
      to: mail.to,
    });
  }
}
