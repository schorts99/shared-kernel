import {
  InMemoryLogger,
  InMemoryMailer,
  LoggingMailer,
} from "../../src";

describe("Mailers", () => {
  it("LoggingMailer logs sent mail through the Logger contract", async () => {
    const logger = new InMemoryLogger();
    const mailer = new LoggingMailer(logger);
    await mailer.send({
      from: "noreply@example.com",
      to: ["customer@example.com"],
      subject: "Order Confirmation",
      text: "Thanks!",
    });
    expect(logger.getByLevel("info")).toHaveLength(1);
    expect(logger.getByLevel("info")[0]?.message).toContain("Order Confirmation");
  });

  it("InMemoryMailer records mail and finds it by recipient case-insensitively", async () => {
    const mailer = new InMemoryMailer();
    await mailer.send({
      to: [{ name: "Ada", email: "Ada@Example.com" }],
      cc: "team@example.com",
      subject: "Welcome!",
      text: "Hello Ada",
    });

    expect(mailer.getSentMails()).toHaveLength(1);
    expect(mailer.getSentTo("ada@example.com")).toHaveLength(1);
    expect(mailer.getSentTo("TEAM@example.com")).toHaveLength(1);
    expect(mailer.getSentTo("other@example.com")).toHaveLength(0);
    mailer.clear();
    expect(mailer.getSentMails()).toHaveLength(0);
  });

  it("accepts Uint8Array and Buffer attachments", async () => {
    const mailer = new InMemoryMailer();
    const bytes = new Uint8Array([37, 80, 68, 70]);

    await mailer.send({
      to: "ada@example.com",
      subject: "Invoice",
      attachments: [
        { filename: "invoice.pdf", content: bytes, contentType: "application/pdf" },
        { filename: "notes.txt", content: Buffer.from("paid") },
      ],
    });

    const [sent] = mailer.getSentMails();
    expect(sent?.attachments?.map(a => a.filename)).toEqual(["invoice.pdf", "notes.txt"]);
    expect(Array.from(sent?.attachments?.[0]?.content as Uint8Array)).toEqual([37, 80, 68, 70]);
  });
});
