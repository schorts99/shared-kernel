import {
  DomainEvent,
  InMemoryCommandBus,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemorySagaStateStore,
  Saga,
  SagaManager,
} from "../../src";
import { NodeExecutionContext } from "../../src/node";
import {
  registerTestMessages,
  SecondaryCommand,
} from "../support/fixtures";

beforeAll(registerTestMessages);

describe("SagaManager", () => {
  it("registers and unregisters sagas", async () => {
    const executionContext = new NodeExecutionContext();
    const eventBus = new InMemoryEventBus(new InMemoryEventStore(), {}, undefined, undefined, executionContext);
    const commandBus = new InMemoryCommandBus({ executionContext });
    const stateStore = new InMemorySagaStateStore();
    let sagaCalls = 0;

    class UnregisterableSaga extends Saga {
      protected getInitialState() {
        return {};
      }
      protected getSagaId(event: DomainEvent): string {
        return event.id;
      }
      protected configure(): void {
        this.on(SecondaryCommand.TYPE, async () => {
          sagaCalls++;
        });
      }
    }

    const sagaManager = new SagaManager(eventBus);
    const saga = new UnregisterableSaga(commandBus, stateStore);
    sagaManager.register(saga);
    expect(sagaManager.getRegisteredSagas()).toEqual([saga]);
    expect(sagaManager.unregister(saga)).toBe(true);
    expect(sagaManager.getRegisteredSagas()).toEqual([]);

    await eventBus.close();
  });
});
