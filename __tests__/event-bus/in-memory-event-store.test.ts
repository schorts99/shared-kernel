import {
  InMemoryEventStore,
} from "../../src";
import {
  registerTestMessages,
  TestDomainEvent,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("InMemoryEventStore", () => {
  it("isolates stored events from caller mutation", async () => {
    const eventStore = new InMemoryEventStore();
    const rawPrimitives = new TestDomainEvent("c-es", { id: "es-1" }, { id: "evt-es-1" }).toPrimitives();
    await eventStore.save(rawPrimitives);
    rawPrimitives.payload.id = "mutated";
    const allEvents = await eventStore.all();
    expect(allEvents[0]?.payload.id).toBe("es-1");
  });
});
