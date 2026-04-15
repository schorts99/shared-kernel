import {
  InMemoryQueryBus,
  Query,
  QueryHandler,
  QueryNotRegistered,
  QueryBusMiddleware,
} from '../../../src/cqrs';

class FakeQuery implements Query {
  static readonly type = 'fake.query';

  constructor(public correlationId: string) {}

  getType() {
    return FakeQuery.type;
  }

  getMetadata() {
    return { correlationId: this.correlationId, userId: 'user-1' };
  }

  toPrimitives() {
    return { foo: 'bar' };
  }
}

class FakeHandler implements QueryHandler<FakeQuery, string> {
  async handle(query: FakeQuery): Promise<string> {
    return `handled:${query.correlationId}`;
  }
}

describe('InMemoryQueryBus', () => {
  let bus: InMemoryQueryBus;
  let handler: FakeHandler;

  beforeEach(() => {
    bus = new InMemoryQueryBus();
    handler = new FakeHandler();
  });

  it('registers and dispatches a query', async () => {
    bus.register(FakeQuery.type, handler);

    const result = await bus.dispatch(new FakeQuery('corr-1'));

    expect(result).toBe('handled:corr-1');
    expect(bus.hasHandler(FakeQuery.type)).toBe(true);
    expect(bus.getRegisteredTypes()).toContain(FakeQuery.type);
  });

  it('throws when dispatching unregistered query', async () => {
    await expect(bus.dispatch(new FakeQuery('corr-2'))).rejects.toBeInstanceOf(QueryNotRegistered);
  });

  it('unregisters a handler', () => {
    bus.register(FakeQuery.type, handler);

    expect(bus.unregister(FakeQuery.type)).toBe(true);
    expect(bus.hasHandler(FakeQuery.type)).toBe(false);
  });

  it('dispatchMany runs multiple queries', async () => {
    bus.register(FakeQuery.type, handler);

    const results = await bus.dispatchMany([
      new FakeQuery('c1'),
      new FakeQuery('c2'),
    ]);

    expect(results).toEqual(['handled:c1', 'handled:c2']);
  });

  it('dispatchMany throws AggregateError when one fails', async () => {
    bus.register(FakeQuery.type, handler);

    const badQuery = { ...new FakeQuery('bad'), getType: () => 'unknown' } as FakeQuery;

    await expect(bus.dispatchMany([new FakeQuery('c1'), badQuery])).rejects.toBeInstanceOf(AggregateError);
  });

  it('applies middleware hooks', async () => {
    const beforeDispatch = jest.fn();
    const afterDispatch = jest.fn();
    const onError = jest.fn();
    const mw: QueryBusMiddleware = { beforeDispatch, afterDispatch, onError };

    bus.use(mw);
    bus.register(FakeQuery.type, handler);

    await bus.dispatch(new FakeQuery('corr-3'));

    expect(beforeDispatch).toHaveBeenCalled();
    expect(afterDispatch).toHaveBeenCalled();

    bus.clear();
    bus.use(mw);
    bus.register(FakeQuery.type, {
      async handle() {
        throw new Error('Handler failed');
      },
    });

    await expect(bus.dispatch(new FakeQuery('corr-4'))).rejects.toThrow('Handler failed');
    expect(onError).toHaveBeenCalled();
  });

  it('sets and gets config', () => {
    bus.setConfig({ enableCaching: true, timeout: 100 });

    const config = bus.getConfig();

    expect(config.enableCaching).toBe(true);
    expect(config.timeout).toBe(100);
  });

  it('removes middleware', () => {
    const mw: QueryBusMiddleware = { beforeDispatch: jest.fn() };

    bus.use(mw);

    expect(bus.removeMiddleware(mw)).toBe(true);
  });

  it('clears handlers and middleware', () => {
    bus.register(FakeQuery.type, handler);
    bus.use({ beforeDispatch: jest.fn() });
    bus.clear();

    expect(bus.hasHandler(FakeQuery.type)).toBe(false);
    expect(bus.getRegisteredTypes()).toEqual([]);
  });
});
