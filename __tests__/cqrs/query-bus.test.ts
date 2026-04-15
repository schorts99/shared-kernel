import { QueryBus, QueryBusMiddleware, QueryBusConfig, QueryHandler } from '../../src/cqrs';

class FakeQuery {
  static readonly type = 'fake.query';

  constructor(public correlationId: string) {}

  getType() {
    return FakeQuery.type;
  }

  getMetadata() {
    return { correlationId: this.correlationId, userId: 'user-1' };
  }
}

class InMemoryQueryBus implements QueryBus {
  private handlers = new Map<string, QueryHandler<any, any>>();
  private middlewares: QueryBusMiddleware[] = [];
  private config: QueryBusConfig = {};

  register<Q, R>(type: string, handler: QueryHandler<Q, R>): void {
    this.handlers.set(type, handler);
  }

  unregister(type: string): boolean {
    return this.handlers.delete(type);
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  async dispatch<Q extends FakeQuery, R>(query: Q): Promise<R> {
    const context = {
      correlationId: query.correlationId,
      startTime: new Date(),
      metadata: query.getMetadata(),
      config: this.config,
    };

    for (const mw of this.middlewares) {
      if (mw.beforeDispatch) await mw.beforeDispatch(query, context);
    }

    try {
      const handler = this.handlers.get(query.getType());

      if (!handler) throw new Error(`No handler for ${query.getType()}`);

      const result = await handler.handle(query, context);

      for (const mw of this.middlewares) {
        if (mw.afterDispatch) await mw.afterDispatch(query, result, context);
      }

      return result;
    } catch (err) {
      for (const mw of this.middlewares) {
        if (mw.onError) await mw.onError(query, err as Error, context);
      }

      throw err;
    }
  }

  async dispatchMany<Q extends FakeQuery, R>(queries: readonly Q[]): Promise<R[]> {
    return Promise.all(queries.map(q => this.dispatch(q)));
  }

  use(middleware: QueryBusMiddleware): void {
    this.middlewares.push(middleware);
  }

  removeMiddleware(middleware: QueryBusMiddleware): boolean {
    const idx = this.middlewares.indexOf(middleware);
    if (idx >= 0) {
      this.middlewares.splice(idx, 1);
      return true;
    }
    return false;
  }

  getConfig(): QueryBusConfig {
    return this.config;
  }

  setConfig(config: Partial<QueryBusConfig>): void {
    this.config = { ...this.config, ...config };
  }

  clear(): void {
    this.handlers.clear();
    this.middlewares = [];
    this.config = {};
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

  it('applies middleware hooks', async () => {
    const beforeDispatch = jest.fn();
    const afterDispatch = jest.fn();
    const onError = jest.fn();

    bus.use({ beforeDispatch, afterDispatch, onError });
    bus.register(FakeQuery.type, handler);

    await bus.dispatch(new FakeQuery('corr-2'));

    expect(beforeDispatch).toHaveBeenCalled();
    expect(afterDispatch).toHaveBeenCalled();

    bus.clear();
    bus.use({ onError });

    await expect(bus.dispatch(new FakeQuery('corr-3'))).rejects.toThrow();
    expect(onError).toHaveBeenCalled();
  });

  it('sets and gets config', () => {
    bus.setConfig({ enableMetrics: true, timeout: 100 });

    expect(bus.getConfig()).toEqual({ enableMetrics: true, timeout: 100 });
  });

  it('removes middleware', () => {
    const mw = { beforeDispatch: jest.fn() };

    bus.use(mw);

    expect(bus.removeMiddleware(mw)).toBe(true);
  });

  it('clears handlers and middleware', () => {
    bus.register(FakeQuery.type, handler);
    bus.use({ beforeDispatch: jest.fn() });
    bus.setConfig({ enableCaching: true });
    bus.clear();

    expect(bus.hasHandler(FakeQuery.type)).toBe(false);
    expect(bus.getRegisteredTypes()).toEqual([]);
    expect(bus.getConfig()).toEqual({});
  });
});
