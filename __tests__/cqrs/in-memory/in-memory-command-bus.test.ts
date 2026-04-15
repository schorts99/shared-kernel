import {
  InMemoryCommandBus,
  Command,
  CommandHandler,
  CommandNotRegistered,
  CommandBusMiddleware,
} from '../../../src/cqrs';

class FakeCommand implements Command {
  static readonly type = 'fake.command';

  constructor(public correlationId: string) {}

  getType() {
    return FakeCommand.type;
  }

  getMetadata() {
    return { correlationId: this.correlationId, userId: 'user-1' };
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

  it('throws when dispatching unregistered command', async () => {
    await expect(bus.dispatch(new FakeCommand('corr-2'))).rejects.toBeInstanceOf(CommandNotRegistered);
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

  it('dispatchMany throws AggregateError when one fails', async () => {
    bus.register(FakeCommand.type, handler);

    const badCommand = { ...new FakeCommand('bad'), getType: () => 'unknown' } as FakeCommand;

    await expect(bus.dispatchMany([new FakeCommand('c1'), badCommand])).rejects.toBeInstanceOf(AggregateError);
  });

  it('applies middleware hooks', async () => {
    const beforeDispatch = jest.fn();
    const afterDispatch = jest.fn();
    const onError = jest.fn();
    const onEvents = jest.fn();
    const mw: CommandBusMiddleware<true> = { beforeDispatch, afterDispatch, onError, onEvents };

    bus.use(mw);
    bus.register(FakeCommand.type, handler);
    await bus.dispatch(new FakeCommand('corr-3'));

    expect(beforeDispatch).toHaveBeenCalled();
    expect(afterDispatch).toHaveBeenCalled();

    bus.clear();
    bus.use(mw);
    bus.register(FakeCommand.type, {
      async handle() {
        throw new Error('Handler failed');
      },
    });

    await expect(bus.dispatch(new FakeCommand('corr-4'))).rejects.toThrow('Handler failed');
    expect(onError).toHaveBeenCalled();
  });

  it('calls onEvents middleware when events are present', async () => {
    const onEvents = jest.fn();

    bus.use({ onEvents });
    bus.register(FakeCommand.type, {
      async handle(command: FakeCommand, context: any) {
        context.events.push({ type: 'TestEvent' });
        return 'ok';
      },
    });

    await bus.dispatch(new FakeCommand('corr-5'));

    expect(onEvents).toHaveBeenCalledWith(
      expect.any(FakeCommand),
      expect.arrayContaining([{ type: 'TestEvent' }]),
      expect.any(Object),
    );
  });

  it('sets and gets config', () => {
    bus.setConfig({ enableLogging: true, transactional: true });

    const config = bus.getConfig();

    expect(config.enableLogging).toBe(true);
    expect(config.transactional).toBe(true);
  });

  it('removes middleware', () => {
    const mw: CommandBusMiddleware<true> = { beforeDispatch: jest.fn() };

    bus.use(mw);

    expect(bus.removeMiddleware(mw)).toBe(true);
  });

  it('clears handlers and middleware', () => {
    bus.register(FakeCommand.type, handler);
    bus.use({ beforeDispatch: jest.fn() });
    bus.clear();

    expect(bus.hasHandler(FakeCommand.type)).toBe(false);
    expect(bus.getRegisteredTypes()).toEqual([]);
  });
});
