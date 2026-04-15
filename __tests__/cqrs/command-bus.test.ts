import { CommandBus, CommandBusMiddleware, CommandBusConfig, CommandHandler } from '../../src/cqrs';

class FakeCommand {
  static readonly type = 'fake.command';

  constructor(public correlationId: string) {}

  getType() {
    return FakeCommand.type;
  }

  getMetadata() {
    return { correlationId: this.correlationId, userId: 'user-1' };
  }
}

class InMemoryCommandBus implements CommandBus {
  private handlers = new Map<string, CommandHandler<any, any>>();
  private middlewares: CommandBusMiddleware[] = [];
  private config: CommandBusConfig = {};
  private events: any[] = [];

  register<C, R>(type: string, handler: CommandHandler<C, R>): void {
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

  async dispatch<C extends FakeCommand, R>(command: C): Promise<R> {
    const context = {
      correlationId: command.correlationId,
      startTime: new Date(),
      metadata: command.getMetadata(),
      config: this.config,
      events: this.events,
    };

    for (const mw of this.middlewares) {
      if (mw.beforeDispatch) await mw.beforeDispatch(command, context);
    }

    try {
      const handler = this.handlers.get(command.getType());

      if (!handler) throw new Error(`No handler for ${command.getType()}`);

      const result = await handler.handle(command, context);

      for (const mw of this.middlewares) {
        if (mw.afterDispatch) await mw.afterDispatch(command, result, context);
        if (mw.onEvents) await mw.onEvents(command, context.events, context);
      }

      return result;
    } catch (err) {
      for (const mw of this.middlewares) {
        if (mw.onError) await mw.onError(command, err as Error, context);
      }

      throw err;
    }
  }

  async dispatchMany<C extends FakeCommand, R>(commands: readonly C[]): Promise<R[]> {
    return Promise.all(commands.map(c => this.dispatch(c)));
  }

  use(middleware: CommandBusMiddleware): void {
    this.middlewares.push(middleware);
  }

  removeMiddleware(middleware: CommandBusMiddleware): boolean {
    const idx = this.middlewares.indexOf(middleware);

    if (idx >= 0) {
      this.middlewares.splice(idx, 1);

      return true;
    }

    return false;
  }

  getConfig(): CommandBusConfig {
    return this.config;
  }

  setConfig(config: Partial<CommandBusConfig>): void {
    this.config = { ...this.config, ...config };
  }

  clear(): void {
    this.handlers.clear();
    this.middlewares = [];
    this.config = {};
    this.events = [];
  }
}

class FakeHandler implements CommandHandler<FakeCommand, string> {
  async handle(command: FakeCommand): Promise<string> {
    return `handled:${command.correlationId}`;
  }
}

describe('InMemoryCommandBus', () => {
  let bus: InMemoryCommandBus;
  let handler: FakeHandler;

  beforeEach(() => {
    bus = new InMemoryCommandBus();
    handler = new FakeHandler();
  });

  it('registers and dispatches a command', async () => {
    bus.register(FakeCommand.type, handler);

    const result = await bus.dispatch(new FakeCommand('corr-1'));

    expect(result).toBe('handled:corr-1');
    expect(bus.hasHandler(FakeCommand.type)).toBe(true);
    expect(bus.getRegisteredTypes()).toContain(FakeCommand.type);
  });

  it('unregisters a handler', () => {
    bus.register(FakeCommand.type, handler);

    expect(bus.unregister(FakeCommand.type)).toBe(true);
    expect(bus.hasHandler(FakeCommand.type)).toBe(false);
  });

  it('dispatchMany runs multiple commands', async () => {
    bus.register(FakeCommand.type, handler);

    const results = await bus.dispatchMany([
      new FakeCommand('c1'),
      new FakeCommand('c2'),
    ]);

    expect(results).toEqual(['handled:c1', 'handled:c2']);
  });

  it('applies middleware hooks', async () => {
    const beforeDispatch = jest.fn();
    const afterDispatch = jest.fn();
    const onError = jest.fn();
    const onEvents = jest.fn();

    bus.use({ beforeDispatch, afterDispatch, onError, onEvents });
    bus.register(FakeCommand.type, handler);

    await bus.dispatch(new FakeCommand('corr-2'));

    expect(beforeDispatch).toHaveBeenCalled();
    expect(afterDispatch).toHaveBeenCalled();
    expect(onEvents).toHaveBeenCalled();

    bus.clear();
    bus.use({ onError });

    await expect(bus.dispatch(new FakeCommand('corr-3'))).rejects.toThrow();
    expect(onError).toHaveBeenCalled();
  });

  it('sets and gets config', () => {
    bus.setConfig({ enableLogging: true, timeout: 100 });

    expect(bus.getConfig()).toEqual({ enableLogging: true, timeout: 100 });
  });

  it('removes middleware', () => {
    const mw = { beforeDispatch: jest.fn() };

    bus.use(mw);

    expect(bus.removeMiddleware(mw)).toBe(true);
  });

  it('clears handlers, middleware, and events', () => {
    bus.register(FakeCommand.type, handler);
    bus.use({ beforeDispatch: jest.fn() });
    bus.setConfig({ transactional: true });
    bus.clear();

    expect(bus.hasHandler(FakeCommand.type)).toBe(false);
    expect(bus.getRegisteredTypes()).toEqual([]);
    expect(bus.getConfig()).toEqual({});
  });
});
