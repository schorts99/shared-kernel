import {
  registerTestMessages,
  TestCommand,
  TestDomainEvent,
  TestQuery,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("Command, Query, and DomainEvent isolation", () => {
  it("isolate metadata and payloads from caller mutation", () => {
    const headers = { "x-trace": "t-1" };
    const context = { nested: { role: "admin" } };
    const cmd = new TestCommand("corr-iso", { id: "c-1" }, { headers, context });
    const qry = new TestQuery("corr-iso", { id: "q-1" }, { headers, context });
    const evt = new TestDomainEvent("corr-iso", { id: "e-1" }, { headers, context });

    headers["x-trace"] = "mutated";
    context.nested.role = "guest";

    expect(cmd.headers).toEqual({ "x-trace": "t-1" });
    expect(cmd.context).toEqual({ nested: { role: "admin" } });
    expect(qry.headers).toEqual({ "x-trace": "t-1" });
    expect(evt.context).toEqual({ nested: { role: "admin" } });

    const cmdPrims = cmd.toPrimitives();
    cmdPrims.headers!["x-trace"] = "mutated-again";
    cmdPrims.payload.id = "mutated-id";
    expect(cmd.headers).toEqual({ "x-trace": "t-1" });
    expect(cmd.getPayload().id).toBe("c-1");
  });
});
