import {
  CommandNotRegistered,
  EntityNotRegistered,
  InMemoryTranslationResolver,
  SharedKernelTranslationKeys,
} from "../../src";

describe("InMemoryTranslationResolver", () => {
  it("replaces every occurrence of a placeholder", () => {
    const resolver = new InMemoryTranslationResolver({
      greeting: "Hello {name}, welcome back {name}!",
    });
    expect(resolver.resolve("greeting", { name: "Grace" })).toBe(
      "Hello Grace, welcome back Grace!",
    );
  });

  it("interpolates params into *NotRegistered exception messages", () => {
    const i18n = new InMemoryTranslationResolver({
      [SharedKernelTranslationKeys.entities.errors.EntityNotRegistered]:
        "Missing entity: {entityName}",
      [SharedKernelTranslationKeys.cqrs.errors.CommandNotRegistered]:
        "Missing command: {command}",
    });

    const entityErr = new EntityNotRegistered("Invoice", i18n);
    expect(entityErr.name).toBe("EntityNotRegistered");
    expect(entityErr.message).toBe("Missing entity: Invoice");

    const cmdErr = new CommandNotRegistered("CreateInvoice", i18n);
    expect(cmdErr.name).toBe("CommandNotRegistered");
    expect(cmdErr.message).toBe("Missing command: CreateInvoice");
  });
});
