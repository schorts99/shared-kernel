import { Mail } from "./mail";
export interface Mailer {
    send(mail: Mail): Promise<void>;
}
//# sourceMappingURL=mailer.d.ts.map