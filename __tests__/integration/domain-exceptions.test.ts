import {
  JSONAPIErrors,
  NotAuthenticated,
  NotAuthorized,
} from "../../src";

describe("Domain exceptions", () => {
  it("set their names, messages, and metadata", () => {
    const jsonApiErr = new JSONAPIErrors([
      {
        status: "400",
        code: "INVALID_FIELD",
        title: "Invalid Attribute",
        detail: "Email is required",
      },
    ]);
    expect(jsonApiErr.name).toBe("JSONAPIErrors");
    expect(jsonApiErr.message).toBe("Invalid Attribute: Email is required");

    const notAuthz = new NotAuthorized();
    expect(notAuthz.name).toBe("NotAuthorized");
    expect(notAuthz.message).toBe("Not Authorized");

    const notAuthen = new NotAuthenticated();
    expect(notAuthen.name).toBe("NotAuthenticated");
    expect(notAuthen.message).toBe("Not Authenticated");
  });
});
