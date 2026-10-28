import {
  AbstractCommand,
  AbstractCommandHandler,
  AbstractQuery,
  AbstractQueryHandler,
  AggregateRoot,
  ArrayValue,
  BooleanValue,
  CommandNotRegistered,
  CommandRegistry,
  ConsoleLogger,
  CoordinatesValue,
  Criteria,
  CrossDispatchCycleError,
  DateValue,
  debounce,
  DomainEvent,
  DomainEventRegistry,
  EmailValue,
  Entity,
  EntityNotRegistered,
  EntityRegistry,
  EnumValue,
  ErrorTracker,
  ErrorTrackingMiddleware,
  FetchHTTPProvider,
  FloatValue,
  HTMLValue,
  HTTPException,
  InMemoryAuthProvider,
  InMemoryCache,
  InMemoryCommandBus,
  InMemoryDAO,
  InMemoryDeadLetterStore,
  InMemoryErrorStore,
  InMemoryEventBus,
  InMemoryEventStore,
  InMemoryHTTPProvider,
  InMemoryIdentityProvider,
  InMemoryLogger,
  InMemoryMailer,
  InMemoryOfflineStore,
  InMemoryPubSub,
  InMemoryQueryBus,
  InMemorySagaStateStore,
  InMemoryStateManager,
  InMemoryTranslationResolver,
  JSONAPIErrors,
  LimitNotValid,
  MarkdownValue,
  NotAuthenticated,
  NotAuthorized,
  ObjectValue,
  OfflineCommandSync,
  OffsetNotValid,
  PaginationLinksGenerator,
  PascalCamelToSnake,
  PathValue,
  PhoneValue,
  QueryRegistry,
  RemoteFileToBase64,
  retry,
  Saga,
  SagaManager,
  SharedKernelTranslationKeys,
  slugify,
  SlugValue,
  SnakeToCamel,
  StaticRBACPolicy,
  StringValue,
  unorderedObjectArrayEqual,
  URLCriteriaBuilder,
  URLCriteriaParser,
  URLValue,
  URLWithParamsBuilder,
  UUIDValue,
  ValuesNotValid,
} from "../src";
import type {
  CommandHandlerContext,
  QueryHandlerContext,
} from "../src";
import { NodeExecutionContext } from "../src/node";
import {
  registerTestMessages,
  TestCommand,
  SecondaryCommand,
  TestQuery,
  TestDomainEvent,
  OrderEntity,
} from "./support/fixtures";

beforeAll(registerTestMessages);

describe("10. Schema Validation, Array Utilities, ErrorTrackingMiddleware on EventBus, SagaManager, and Retry", () => {
  it("handles { required: false } and key-order-independent equals in ObjectValue/ArrayValue, and multiplicity in unorderedObjectArrayEqual", () => {
    interface ConfigPayload {
      host: string;
      port?: number | undefined;
    }

    class ConfigObjectValue extends ObjectValue<ConfigPayload> {
      readonly attributeName = "config";
      constructor(value: ConfigPayload) {
        super(value, {
          host: [{ required: true }, { type: "string" }],
          port: [{ required: false }, { type: "number" }],
        });
      }
    }

    const cfgWithoutOptional = new ConfigObjectValue({ host: "localhost" });
    expect(cfgWithoutOptional.isValid).toBe(true);

    const cfgKeyOrder1 = new ConfigObjectValue({ host: "localhost", port: 8080 });
    const cfgKeyOrder2 = new ConfigObjectValue({ port: 8080, host: "localhost" });
    expect(cfgKeyOrder1.equals(cfgKeyOrder2)).toBe(true);

    class TagsArrayValue extends ArrayValue<{ a: number; b: number }> {
      readonly attributeName = "tags";
      readonly isPrimitive = false;
      constructor(value: Array<{ a: number; b: number }>) {
        super(value, {
          a: [{ required: true }, { type: "number" }],
          b: [{ required: true }, { type: "number" }],
        });
      }
    }

    const arr1 = new TagsArrayValue([{ a: 1, b: 2 }]);
    const arr2 = new TagsArrayValue([{ b: 2, a: 1 }]);
    expect(arr1.equals(arr2)).toBe(true);

    // unorderedObjectArrayEqual checks duplicate counts and nested keys
    expect(
      unorderedObjectArrayEqual(
        [{ id: 1 }, { id: 1 }, { id: 2 }],
        [{ id: 1 }, { id: 2 }, { id: 2 }],
      ),
    ).toBe(false);

    expect(
      unorderedObjectArrayEqual(
        [{ meta: { x: 1, y: 2 } }, { meta: { a: 3, b: 4 } }],
        [{ meta: { b: 4, a: 3 } }, { meta: { y: 2, x: 1 } }],
      ),
    ).toBe(true);
  });

  it("tracks EventBus errors in ErrorTrackingMiddleware, supports SagaManager.unregister, and supports retry options", async () => {
    const executionContext = new NodeExecutionContext();
    const errorStore = new InMemoryErrorStore();
    const errorTracker = new ErrorTracker(errorStore, { upload: async () => {} });
    const middleware = new ErrorTrackingMiddleware(errorTracker);

    const eventBus = new InMemoryEventBus(
      new InMemoryEventStore(),
      { maxRetries: 0 },
      undefined,
      undefined,
      executionContext,
    );
    eventBus.use(middleware);

    eventBus.subscribe(TestDomainEvent.NAME, {
      getName: () => "failing-sub",
      handle: async () => {
        throw new Error("event subscriber failed");
      },
    });

    await expect(
      eventBus.publish(new TestDomainEvent("corr-err-mw", { id: "e-mw" }, { id: "evt-mw-1" })),
    ).rejects.toThrow("event subscriber failed");

    const tracked = await errorStore.all();
    expect(tracked).toHaveLength(1);
    expect(tracked[0]?.reason).toBe(`Failed to execute event: ${TestDomainEvent.NAME}`);
    expect(tracked[0]?.context?.requestType).toBe("event");

    // SagaManager register / unregister
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

    // retry with options & shouldRetry
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("transient");
        }
        return "recovered";
      },
      {
        retries: 3,
        delayMs: 5,
        backoffFactor: 2,
        maxDelayMs: 20,
        shouldRetry: err => err instanceof Error && err.message === "transient",
      },
    );
    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
  });

  it("enforces PathValue traversal protection, DateValue invalid date check, PhoneValue anchor, EmailValue TLDs/+ tags, UUIDv7, and String/Coordinates/Boolean validation", () => {
    class UploadPath extends PathValue {
      readonly attributeName = "uploadPath";
    }
    expect(new UploadPath("/var/uploads/report.pdf", ["/var/uploads"]).isValid).toBe(true);
    expect(new UploadPath("/var/uploads/../../etc/passwd", ["/var/uploads"]).isValid).toBe(false);
    expect(new UploadPath("/var/uploads-other/file.txt", ["/var/uploads"]).isValid).toBe(false);
    expect(new UploadPath("/var/uploads/file\0.txt", ["/var/uploads"]).isValid).toBe(false);

    class CreatedDate extends DateValue {
      readonly attributeName = "createdAt";
    }
    expect(CreatedDate.fromPrimitives("not-a-valid-date").isValid).toBe(false);
    expect(CreatedDate.fromPrimitives("2026-10-28T00:00:00.000Z").isValid).toBe(true);

    class ContactPhone extends PhoneValue {
      readonly attributeName = "phone";
    }
    expect(new ContactPhone("+12345678901").isValid).toBe(true);
    expect(new ContactPhone("call me at +12345678901").isValid).toBe(false);

    class UserEmail extends EmailValue {
      readonly attributeName = "email";
    }
    expect(new UserEmail("dev+alerts@company.engineering").isValid).toBe(true);

    // UUIDv7 support and case-insensitive equality
    const uuidV7Lower = UUIDValue.fromPrimitives("018f3b24-a450-7b2c-9d1e-34567890abcd");
    const uuidV7Upper = UUIDValue.fromPrimitives("018F3B24-A450-7B2C-9D1E-34567890ABCD");
    expect(uuidV7Lower.isValid).toBe(true);
    expect(uuidV7Lower.equals(uuidV7Upper)).toBe(true);

    class EmptyOnlyString extends StringValue {
      readonly attributeName = "empty";
    }
    expect(new EmptyOnlyString("", 0, 0).isValid).toBe(true);
    expect(new EmptyOnlyString("a", 0, 0).isValid).toBe(false);

    expect(CoordinatesValue.fromPrimitives({ latitude: Number.NaN, longitude: 0 }).isValid).toBe(false);

    class FlagBoolean extends BooleanValue {
      readonly attributeName = "flag";
    }
    expect(new FlagBoolean(true).isValid).toBe(true);
    expect(new FlagBoolean("true" as unknown as boolean).isValid).toBe(false);
  });

  it("supports non-mutating URLWithParamsBuilder, circular-safe ConsoleLogger, InMemoryLogger, InMemoryAuthProvider, and InMemoryIdentityProvider", async () => {
    const originalUrl = new URL("https://api.example.com/items?tag=legacy&keep=1");
    const builtUrl = new URLWithParamsBuilder(originalUrl)
      .with({ tag: ["alpha", "beta"], keep: undefined, page: 2 })
      .build();

    expect(originalUrl.toString()).toBe("https://api.example.com/items?tag=legacy&keep=1");
    expect(builtUrl.searchParams.getAll("tag")).toEqual(["alpha", "beta"]);
    expect(builtUrl.searchParams.get("keep")).toBeNull();
    expect(builtUrl.searchParams.get("page")).toBe("2");

    // ConsoleLogger safe serialization for circular refs and BigInt
    const consoleSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    try {
      const consoleLogger = new ConsoleLogger("info");
      const circular: Record<string, unknown> = { count: BigInt(42) };
      circular.self = circular;
      expect(() => consoleLogger.info("circular context", circular)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('"count":"42"');
      expect(consoleSpy.mock.calls[0]?.[0]).toContain('"[Circular]"');
    } finally {
      consoleSpy.mockRestore();
    }

    // InMemoryLogger
    const memLogger = new InMemoryLogger("info");
    memLogger.debug("ignored debug");
    const mutableCtx = { requestId: "req-1" };
    memLogger.info("handled request", mutableCtx);
    mutableCtx.requestId = "mutated";

    expect(memLogger.getEntries()).toHaveLength(1);
    expect(memLogger.getByLevel("info")[0]?.context).toEqual({ requestId: "req-1" });
    memLogger.clear();
    expect(memLogger.getEntries()).toHaveLength(0);

    // InMemoryAuthProvider
    class AuthUserEntity extends Entity<UUIDValue, { id: string; name: string }> {
      constructor(id: UUIDValue, public name: string) {
        super(id);
      }
      protected createId(rawId: string): UUIDValue {
        return UUIDValue.fromPrimitives(rawId);
      }
      toPrimitives() {
        return { id: this.id.value, name: this.name };
      }
      restoreFromPrimitives(data: { id: string; name: string }): void {
        this.name = data.name;
      }
    }

    const authUser = new AuthUserEntity(
      new UUIDValue("123e4567-e89b-12d3-a456-426614174000"),
      "Ada",
    );
    const authProvider = new InMemoryAuthProvider({
      users: [
        {
          user: authUser,
          email: "ada@example.com",
          password: "secret",
          roles: ["admin"],
          permissions: [{ resource: "orders", action: "read" }],
        },
      ],
    });

    const authEvents: Array<string | null> = [];
    const unsubscribe = authProvider.onAuthChange(session => {
      authEvents.push(session ? String(session.user.id.value) : null);
    });

    const authResult = await authProvider.authenticate({
      email: "ada@example.com",
      password: "secret",
    });
    expect(authResult.token).toContain("access_");
    expect(await authProvider.isAuthenticated()).toBe(true);
    expect(await authProvider.getCurrentUserRoles()).toEqual(["admin"]);

    const refreshed = await authProvider.refreshToken(authResult.refreshToken);
    expect(refreshed.token).not.toBe(authResult.token);

    await authProvider.logout();
    expect(await authProvider.isAuthenticated()).toBe(false);
    unsubscribe();
    expect(authEvents).toEqual([
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-12d3-a456-426614174000",
      null,
    ]);

    // InMemoryIdentityProvider
    const idp = new InMemoryIdentityProvider();
    const createdUser = await idp.createUser({
      email: "grace@example.com",
      displayName: "Grace Hopper",
      emailVerified: true,
    });
    await idp.setCustomClaims(createdUser.id, { tier: "enterprise" });

    const idpToken = idp.issueToken(createdUser.id, undefined, { scope: "full" });
    const verified = await idp.verifyToken(idpToken);
    expect(verified).toEqual({
      userId: createdUser.id,
      claims: { tier: "enterprise", scope: "full" },
    });

    await idp.deleteUser(createdUser.id);
    await expect(idp.verifyToken(idpToken)).rejects.toThrow();
  });

  it("aligns slugify with SlugValue, supports optional arrays/TypedArrays in ObjectValue, adds InMemoryMailer, and supports debounce.flush/pending", async () => {
    class ArticleSlug extends SlugValue {
      readonly attributeName = "slug";
    }

    const slugFromUnderscores = slugify("  Hello_World -- Café Crème!  ");
    expect(slugFromUnderscores).toBe("hello-world-cafe-creme");
    expect(new ArticleSlug(slugFromUnderscores).isValid).toBe(true);

    interface OptionalArrayPayload {
      title: string;
      tags?: string[];
      rawBytes?: Uint8Array;
    }

    class OptionalArrayObjectValue extends ObjectValue<OptionalArrayPayload> {
      readonly attributeName = "payload";
      constructor(value: OptionalArrayPayload) {
        super(value, {
          title: [{ required: true }, { type: "string" }],
          tags: { _: [{ required: false }, { type: "string" }] },
        });
      }
    }

    const voWithBytes = new OptionalArrayObjectValue({
      title: "Report",
      rawBytes: new Uint8Array([1, 2, 3]),
    });
    expect(voWithBytes.isValid).toBe(true);

    // InMemoryMailer
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

    // debounce.flush() and debounce.pending()
    const calls: string[] = [];
    const debouncedFn = debounce((val: string) => {
      calls.push(val);
    }, 5000);

    expect(debouncedFn.pending()).toBe(false);
    debouncedFn("first");
    debouncedFn("second");
    expect(debouncedFn.pending()).toBe(true);
    expect(calls).toEqual([]);

    debouncedFn.flush();
    expect(debouncedFn.pending()).toBe(false);
    expect(calls).toEqual(["second"]);
  });

  it("enforces type-safe Entity/AggregateRoot equality, exact event sequence numbers, FloatValue Infinity/rounding fixes, ValuesNotValid message, and InMemoryPubSub isolation/wildcards", async () => {
    const sharedUuid = new UUIDValue("123e4567-e89b-12d3-a456-426614174000");

    class UserEntity extends Entity<UUIDValue, { id: string }> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }
    class OrderEntity extends Entity<UUIDValue, { id: string }> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }

    const userEnt = new UserEntity(sharedUuid);
    const userEnt2 = new UserEntity(sharedUuid);
    const orderEnt = new OrderEntity(sharedUuid);

    expect(userEnt.equals(userEnt2)).toBe(true);
    expect(userEnt.equals(orderEnt)).toBe(false);

    class OrderAggregate extends AggregateRoot<UUIDValue> {
      touchWithoutEvent(): void {
        this.incrementVersion();
      }
      emit(event: DomainEvent): void {
        this.recordDomainEvent(event);
      }
      toPrimitives() {
        return { id: this.id.value };
      }
    }
    class InvoiceAggregate extends AggregateRoot<UUIDValue> {
      toPrimitives() {
        return { id: this.id.value };
      }
    }

    const orderAgg = new OrderAggregate(sharedUuid, 0);
    const invoiceAgg = new InvoiceAggregate(sharedUuid, 0);

    expect(orderAgg.equals(null)).toBe(false);
    expect(orderAgg.equals(invoiceAgg)).toBe(false);
    expect(orderAgg.equals(new OrderAggregate(sharedUuid, 5))).toBe(true);

    orderAgg.emit(new TestDomainEvent("c-1", { id: "1" }, { id: "ev-1" })); // version 1, seq 1
    orderAgg.touchWithoutEvent(); // version 2
    orderAgg.emit(new TestDomainEvent("c-1", { id: "2" }, { id: "ev-2" })); // version 3, seq 3

    const pulled = orderAgg.pullDomainEvents();
    expect(pulled.map(e => e.sequenceNumber)).toEqual([1, 3]);

    orderAgg.emit(new TestDomainEvent("c-1", { id: "3" }, { id: "ev-3" })); // version 4
    expect(orderAgg.version).toBe(4);
    orderAgg.clearDomainEvents();
    expect(orderAgg.version).toBe(3);

    // FloatValue Infinity rejection and IEEE-754 rounding
    class PriceFloat extends FloatValue {
      readonly attributeName = "price";
    }
    expect(new PriceFloat(Number.POSITIVE_INFINITY).isValid).toBe(false);
    expect(new PriceFloat(Number.NEGATIVE_INFINITY).isValid).toBe(false);
    const roundedPrice = new PriceFloat(1.005, 2);
    expect(roundedPrice.value).toBe(1.01);
    expect(roundedPrice.toString()).toBe("1.01");
    expect(roundedPrice.toJSON()).toBe(1.01);

    // ValuesNotValid message and name
    const invalidErr = new ValuesNotValid([
      Object.assign(new Error("Must be valid email"), { attributeName: "email" }),
      Object.assign(new Error(""), { attributeName: "age" }),
    ]);
    expect(invalidErr.name).toBe("ValuesNotValid");
    expect(invalidErr.message).toBe("Invalid values: email (Must be valid email), age");

    // InMemoryPubSub payload isolation and wildcard subscriptions
    const pubSub = new InMemoryPubSub();
    const receivedByExact: Array<{ count: number }> = [];
    const receivedByChannelWildcard: Array<{ count: number }> = [];
    const receivedByGlobalWildcard: Array<{ count: number }> = [];

    await pubSub.subscribe<{ count: number }>("orders", "created", payload => {
      payload.count = 999; // mutate in first subscriber
      receivedByExact.push(payload);
    });
    await pubSub.subscribe<{ count: number }>("orders", "*", payload => {
      receivedByChannelWildcard.push(payload);
    });
    await pubSub.subscribe<{ count: number }>("*", "*", payload => {
      receivedByGlobalWildcard.push(payload);
    });

    await pubSub.publish("orders", "created", { count: 1 });

    expect(receivedByExact).toEqual([{ count: 999 }]);
    expect(receivedByChannelWildcard).toEqual([{ count: 1 }]);
    expect(receivedByGlobalWildcard).toEqual([{ count: 1 }]);
  });

  it("supports array/replacement query params, async getAuthorization, empty JSON bodies in FetchHTTPProvider, HTTPException message, and InMemoryHTTPProvider", async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedAuth: string | null = null;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedAuth = new Headers(init?.headers).get("Authorization");
      return new Response("", {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const http = new FetchHTTPProvider({
        baseUrl: "https://api.example.com",
        getAuthorization: async () => "Bearer async-token-123",
      });

      const res = await http.post("/items?page=1", {
        query: { page: 2, tag: ["x", "y"] },
        body: { name: "Item" },
      });

      expect(res).toBeUndefined();
      expect(capturedUrl).toBe("https://api.example.com/items?page=2&tag=x&tag=y");
      expect(capturedAuth).toBe("Bearer async-token-123");
    } finally {
      globalThis.fetch = originalFetch;
    }

    const httpErr = new HTTPException(422, { error: "Unprocessable" });
    expect(httpErr.name).toBe("HTTPException");
    expect(httpErr.message).toBe("HTTP Error 422");

    // InMemoryHTTPProvider
    const memHttp = new InMemoryHTTPProvider({ baseUrl: "https://api.example.com" });
    memHttp.on("GET", "/orders", req => ({
      items: ["o-1"],
      filter: req.url.searchParams.getAll("status"),
    }));

    const ordersRes = await memHttp.get<{ items: string[]; filter: string[] }>("/orders", {
      query: { status: ["open", "pending"] },
    });
    expect(ordersRes).toEqual({ items: ["o-1"], filter: ["open", "pending"] });
    expect(memHttp.getRequests()).toHaveLength(1);
    expect(memHttp.getRequests()[0]?.url.href).toBe(
      "https://api.example.com/orders?status=open&status=pending",
    );

    await expect(memHttp.get("/missing")).rejects.toThrow("HTTP Error 404");
  });

  it("round-trips GEO_RADIUS and Date filters between URLCriteriaBuilder and URLCriteriaParser, validates Criteria constructor, and populates domain exception metadata", () => {
    const startDate = new Date("2026-01-15T10:30:00.000Z");
    const initialCriteria = Criteria.none()
      .where("createdAt", "GREATER_THAN_OR_EQUAL", startDate)
      .where("location", "GEO_RADIUS", { center: [40.7128, -74.006], radiusInM: 2500 });

    const builtUrl = new URLCriteriaBuilder(
      new URL("https://api.example.com/events"),
      initialCriteria,
    ).build();

    expect(builtUrl.searchParams.get("filter[createdAt][gte]")).toBe("2026-01-15T10:30:00.000Z");
    expect(builtUrl.searchParams.get("filter[location][geo_radius]")).toBe(
      "40.7128,-74.006,2500",
    );

    const parsedCriteria = new URLCriteriaParser(builtUrl, ["createdAt", "location"]).parse();
    expect(parsedCriteria.filters[0]?.value).toEqual(startDate);
    expect(parsedCriteria.filters[1]?.value).toEqual({
      center: [40.7128, -74.006],
      radiusInM: 2500,
      lat: 40.7128,
      lng: -74.006,
      radius: 2500,
    });

    const rebuiltUrl = new URLCriteriaBuilder(
      new URL("https://api.example.com/events"),
      parsedCriteria,
    ).build();
    expect(rebuiltUrl.toString()).toBe(builtUrl.toString());

    // Criteria constructor & fromPrimitives validation
    expect(() => new Criteria([], [], 0)).toThrow(LimitNotValid);
    expect(() => Criteria.fromPrimitives({ offset: -1 })).toThrow(OffsetNotValid);

    // Domain exception names & messages
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

  it("supports registry has/unregister/clear, i18n param forwarding on *NotRegistered exceptions, and hash-preserving PaginationLinksGenerator", () => {
    CommandRegistry.register("temp.cmd", p => TestCommand.fromPrimitives(p));
    expect(CommandRegistry.has("temp.cmd")).toBe(true);
    expect(CommandRegistry.unregister("temp.cmd")).toBe(true);
    expect(CommandRegistry.has("temp.cmd")).toBe(false);

    QueryRegistry.register("temp.qry", p => TestQuery.fromPrimitives(p));
    expect(QueryRegistry.has("temp.qry")).toBe(true);
    QueryRegistry.clear();
    expect(QueryRegistry.has("temp.qry")).toBe(false);
    QueryRegistry.register(TestQuery.TYPE, TestQuery);

    EntityRegistry.register("temp.entity", () => ({}) as any);
    expect(EntityRegistry.has("temp.entity")).toBe(true);
    expect(EntityRegistry.unregister("temp.entity")).toBe(true);
    expect(EntityRegistry.has("temp.entity")).toBe(false);

    class MinimalRegisteredEvent extends DomainEvent<{ ok: boolean }> {
      getEventName(): string {
        return "temp.event";
      }
      getPayload() {
        return this.payload;
      }
    }
    DomainEventRegistry.register("temp.event", MinimalRegisteredEvent);
    expect(DomainEventRegistry.has("temp.event")).toBe(true);
    const hydratedMinimal = DomainEventRegistry.fromPrimitives({
      id: "ev-min-1",
      type: "temp.event",
      correlation_id: "corr-min",
      occurred_at: "2026-01-01T00:00:00.000Z",
      payload: { ok: true },
    } as any);
    expect(hydratedMinimal.getPayload()).toEqual({ ok: true });
    DomainEventRegistry.unregister("temp.event");
    expect(DomainEventRegistry.has("temp.event")).toBe(false);

    // i18n interpolation on EntityNotRegistered & CommandNotRegistered
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

    // PaginationLinksGenerator with hash fragment and safe integer check
    const linksGen = new PaginationLinksGenerator(
      new URL("https://api.example.com/orders#results"),
    );
    const links = linksGen.generate(0, 10, 25);
    expect(links.self).toBe("https://api.example.com/orders?page[offset]=0&page[limit]=10#results");
    expect(links.next).toBe("https://api.example.com/orders?page[offset]=10&page[limit]=10#results");
    expect(() => linksGen.generate(1.5, 10, 25)).toThrow(OffsetNotValid);
  });

  it("dispatches unregistered Command/Query/DomainEvent via constructor fromPrimitives, isolates concurrent EventBus subscribers, and supports EventBus/DeadLetterStore helpers", async () => {
    const executionContext = new NodeExecutionContext();

    class LocalUnregisteredCommand extends AbstractCommand<{ amount: number }> {
      static readonly TYPE = "local.unregistered.command";
      getType(): string {
        return LocalUnregisteredCommand.TYPE;
      }
    }

    class LocalUnregisteredQuery extends AbstractQuery<{ id: string }> {
      static readonly TYPE = "local.unregistered.query";
      getType(): string {
        return LocalUnregisteredQuery.TYPE;
      }
    }

    class LocalUnregisteredEvent extends DomainEvent<{ items: string[] }> {
      static readonly NAME = "local.unregistered.event";
      getEventName(): string {
        return LocalUnregisteredEvent.NAME;
      }
    }

    const commandBus = new InMemoryCommandBus({ executionContext });
    commandBus.register<LocalUnregisteredCommand, number>(LocalUnregisteredCommand.TYPE, {
      handle: async cmd => cmd.getPayload().amount * 2,
    });
    expect(
      await commandBus.dispatch(new LocalUnregisteredCommand("corr-local", { amount: 21 })),
    ).toBe(42);

    const queryBus = new InMemoryQueryBus({ executionContext });
    queryBus.register<LocalUnregisteredQuery, string>(LocalUnregisteredQuery.TYPE, {
      handle: async qry => `found:${qry.getPayload().id}`,
    });
    expect(
      await queryBus.dispatch(new LocalUnregisteredQuery("corr-local", { id: "item-7" })),
    ).toBe("found:item-7");

    // InMemoryEventBus subscriber isolation, retry without global registration, and lifecycle helpers
    const deadLetterStore = new InMemoryDeadLetterStore();
    const eventBus = new InMemoryEventBus(
      new InMemoryEventStore(),
      { maxRetries: 1 },
      deadLetterStore,
      undefined,
      executionContext,
    );

    const observedItemsBySub2: string[][] = [];
    let sub1Attempts = 0;

    eventBus.subscribe<LocalUnregisteredEvent>(LocalUnregisteredEvent.NAME, {
      getName: () => "sub-1-mutating-and-retrying",
      getOptions: () => ({ priority: 10 }),
      handle: async event => {
        sub1Attempts++;
        event.getPayload().items.push("mutated-by-sub1");
        event.addHeaders({ "x-mutated": "true" });
        if (sub1Attempts === 1) {
          throw new Error("transient sub1 failure");
        }
      },
    });

    eventBus.subscribe<LocalUnregisteredEvent>(LocalUnregisteredEvent.NAME, {
      getName: () => "sub-2-isolated",
      getOptions: () => ({ priority: 5 }),
      handle: async event => {
        observedItemsBySub2.push([...event.getPayload().items]);
        expect(event.headers).toBeNull();
      },
    });

    expect(eventBus.hasSubscribers(LocalUnregisteredEvent.NAME)).toBe(true);
    expect(eventBus.getSubscribedEvents()).toEqual([LocalUnregisteredEvent.NAME]);

    let middlewareCalls = 0;
    const mw = {
      beforePublish: async () => {
        middlewareCalls++;
      },
    };
    eventBus.use(mw);
    expect(eventBus.removeMiddleware(mw)).toBe(true);

    await eventBus.publish(
      new LocalUnregisteredEvent("corr-ev", { items: ["original"] }, { id: "ev-local-1" }),
    );

    expect(sub1Attempts).toBe(2);
    expect(observedItemsBySub2).toEqual([["original"]]);
    expect(middlewareCalls).toBe(0);

    // DeadLetterStore clone isolation
    const rawPrimitives = new LocalUnregisteredEvent("corr-dlq", { items: ["a"] }).toPrimitives();
    await deadLetterStore.add(rawPrimitives, "failed");
    rawPrimitives.payload.items.push("mutated-outside");
    const dlqItems = await deadLetterStore.all();
    expect(dlqItems[0]?.primitives.payload.items).toEqual(["a"]);
    dlqItems[0]!.primitives.payload.items.push("mutated-after-all");
    expect((await deadLetterStore.all())[0]?.primitives.payload.items).toEqual(["a"]);

    eventBus.clear();
    expect(eventBus.getSubscribedEvents()).toEqual([]);
    await eventBus.close();
    await commandBus.close();
    await queryBus.close();
  });

  it("supports handler-owned query caching across distinct Query instances, deterministic getIdempotencyKey across timestamps, and handler-level timeout options", async () => {
    const cacheStore = new InMemoryCache<unknown>();
    let queryExecutions = 0;

    class CachedQueryHandler extends AbstractQueryHandler<TestQuery, { value: string }> {
      constructor() {
        super({ cache: true, cacheStore, cacheTtl: 60_000 });
      }
      async execute(query: TestQuery): Promise<{ value: string }> {
        queryExecutions++;
        return { value: `val:${query.getPayload().id}` };
      }
    }

    const cachedQueryHandler = new CachedQueryHandler();
    const res1 = await cachedQueryHandler.handle(
      new TestQuery("corr-a", { id: "item-99" }, { createdAt: new Date(1000) }),
    );
    const res2 = await cachedQueryHandler.handle(
      new TestQuery("corr-b", { id: "item-99" }, { createdAt: new Date(9000) }),
    );
    expect(res1).toEqual({ value: "val:item-99" });
    expect(res2).toEqual({ value: "val:item-99" });
    expect(queryExecutions).toBe(1);

    // Deterministic getIdempotencyKey ignoring createdAt and correlationId
    class IdempCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(): Promise<void> {}
    }
    const idempHandler = new IdempCmdHandler();
    const cmdAttempt1 = new TestCommand(
      "corr-1",
      { id: "ord-1" },
      { id: "cmd-fixed-id", createdAt: new Date(1000) },
    );
    const cmdAttempt2 = new TestCommand(
      "corr-2",
      { id: "ord-1" },
      { id: "cmd-fixed-id", createdAt: new Date(5000) },
    );
    expect(idempHandler.getIdempotencyKey(cmdAttempt1)).toBe(
      idempHandler.getIdempotencyKey(cmdAttempt2),
    );

    // Handler-level timeout option on AbstractCommandHandler & AbstractQueryHandler
    class SlowTimeoutCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      constructor() {
        super({ timeout: 15 });
      }
      async execute(_cmd: TestCommand, ctx: CommandHandlerContext): Promise<void> {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 200);
          ctx.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(ctx.signal?.reason);
            },
            { once: true },
          );
        });
      }
    }

    class SlowTimeoutQueryHandler extends AbstractQueryHandler<TestQuery, string> {
      constructor() {
        super({ timeout: 15 });
      }
      async execute(_qry: TestQuery, ctx: QueryHandlerContext): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => resolve("done"), 200);
          ctx.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(ctx.signal?.reason);
            },
            { once: true },
          );
        });
      }
    }

    await expect(
      new SlowTimeoutCmdHandler().handle(new TestCommand("corr-t", { id: "1" })),
    ).rejects.toThrow("Command timed out after 15ms");

    await expect(
      new SlowTimeoutQueryHandler().handle(new TestQuery("corr-t", { id: "1" })),
    ).rejects.toThrow("Query timed out after 15ms");
  });

  it("clones caller inputs before freezing in ObjectValue/ArrayValue, serializes concurrent sync() in OfflineCommandSync and ErrorTracker, and supports RegExp/predicate ignoredErrors", async () => {
    // 1. ObjectValue & ArrayValue non-mutating input freezing
    class SampleObjVO extends ObjectValue<{ meta: { count: number } }> {
      readonly attributeName = "sampleObj";
      constructor(val: { meta: { count: number } }) {
        super(val, { meta: { count: [{ required: true }, { type: "number" }] } });
      }
    }

    class SampleArrVO extends ArrayValue<{ label: string }> {
      readonly attributeName = "sampleArr";
      readonly isPrimitive = false;
      constructor(val: Array<{ label: string }>) {
        super(val, { label: [{ required: true }, { type: "string" }] });
      }
    }

    const callerObj = { meta: { count: 1 } };
    const objVo = new SampleObjVO(callerObj);
    expect(Object.isFrozen(callerObj)).toBe(false);
    expect(Object.isFrozen(callerObj.meta)).toBe(false);
    expect(Object.isFrozen(objVo.value)).toBe(true);
    expect(Object.isFrozen(objVo.value.meta)).toBe(true);
    callerObj.meta.count = 99;
    expect(objVo.value.meta.count).toBe(1);

    const callerArr = [{ label: "a" }];
    const arrVo = new SampleArrVO(callerArr);
    expect(Object.isFrozen(callerArr)).toBe(false);
    expect(Object.isFrozen(callerArr[0])).toBe(false);
    expect(Object.isFrozen(arrVo.value)).toBe(true);
    expect(Object.isFrozen(arrVo.value[0])).toBe(true);
    callerArr.push({ label: "b" });
    callerArr[0]!.label = "mutated";
    expect(arrVo.value).toEqual([{ label: "a" }]);

    // 2. Concurrent OfflineCommandSync.sync() serialization
    const offlineStore = new InMemoryOfflineStore();
    const commandBus = new InMemoryCommandBus();
    const dispatchedIds: string[] = [];

    class DelayedCmdHandler extends AbstractCommandHandler<TestCommand, void> {
      async execute(command: TestCommand): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 15));
        dispatchedIds.push(command.getPayload().id);
      }
    }
    commandBus.register(TestCommand.TYPE, new DelayedCmdHandler());

    const syncer = new OfflineCommandSync(offlineStore, commandBus, {
      hydrateCommand: (p) => TestCommand.fromPrimitives(p),
    });

    await syncer.enqueueCommand(new TestCommand("corr-1", { id: "cmd-1" }));
    await syncer.enqueueCommand(new TestCommand("corr-2", { id: "cmd-2" }));

    const [syncRes1, syncRes2] = await Promise.all([syncer.sync(), syncer.sync()]);
    expect(syncRes1.processed + syncRes2.processed).toBe(2);
    expect(dispatchedIds).toEqual(["cmd-1", "cmd-2"]);
    await commandBus.close();

    // 3. Concurrent ErrorTracker.sync() serialization + RegExp & predicate ignoredErrors
    const errorStore = new InMemoryErrorStore();
    const uploadedBatches: string[][] = [];
    const tracker = new ErrorTracker(
      errorStore,
      {
        upload: async (errors) => {
          await new Promise((resolve) => setTimeout(resolve, 15));
          uploadedBatches.push(
            errors.map((e) => (typeof e.error === "string" ? e.error : e.error.message)),
          );
        },
      },
      undefined,
      {
        ignoredErrors: [
          /^ResizeObserver loop/i,
          (err) => typeof err === "object" && "code" in err && (err as { code?: string }).code === "E_SKIP",
        ],
      },
    );

    await tracker.track("ResizeObserver loop completed with undelivered notifications");
    await tracker.track(Object.assign(new Error("Skipped by predicate"), { code: "E_SKIP" }));
    await tracker.track(new Error("Real failure 1"));
    await tracker.track("Real failure 2");

    await Promise.all([tracker.sync(), tracker.sync()]);
    expect(uploadedBatches).toEqual([["Real failure 1", "Real failure 2"]]);
    expect(await errorStore.all()).toEqual([]);
  });

  it("supports toString/toJSON, reference isolation, and non-string guards on ValueObjects, plus deep Criteria and Command/Query/DomainEvent isolation", () => {
    class TestEmailVO extends EmailValue {
      readonly attributeName = "email";
    }
    class TestPhoneVO extends PhoneValue {
      readonly attributeName = "phone";
    }
    class TestSlugVO extends SlugValue {
      readonly attributeName = "slug";
    }
    class TestEnumVO extends EnumValue<readonly ["draft", "published"]> {
      readonly attributeName = "status";
      constructor(val: "draft" | "published") {
        super(["draft", "published"] as const, val);
      }
    }
    class TestDateVO extends DateValue {
      readonly attributeName = "date";
    }
    class TestCoordsVO extends CoordinatesValue {
      readonly attributeName = "coords";
    }
    class TestUrlVO extends URLValue {
      readonly attributeName = "url";
    }
    class TestHtmlVO extends HTMLValue {
      readonly attributeName = "html";
    }
    class TestMarkdownVO extends MarkdownValue {
      readonly attributeName = "markdown";
    }

    const emailVo = new TestEmailVO("dev@example.com");
    const phoneVo = new TestPhoneVO("+14155552671");
    const slugVo = new TestSlugVO("my-slug");
    const enumVo = new TestEnumVO("published");
    const rawDate = new Date("2026-05-01T12:00:00.000Z");
    const dateVo = new TestDateVO(rawDate);
    const rawCoords = { latitude: 37.7749, longitude: -122.4194 };
    const coordsVo = new TestCoordsVO(rawCoords);
    const rawUrl = new URL("https://example.com/original");
    const urlVo = new TestUrlVO(rawUrl, ["example.com"]);

    // Mutate caller-owned Date, Coordinates object, and URL after construction
    rawDate.setUTCFullYear(1999);
    rawCoords.latitude = 0;
    rawUrl.pathname = "/mutated";

    expect(dateVo.toPrimitives()).toBe("2026-05-01T12:00:00.000Z");
    expect(coordsVo.latitude).toBe(37.7749);
    expect(urlVo.toPrimitives()).toBe("https://example.com/original");

    // Verify JSON.stringify and String() across all value objects
    expect(JSON.parse(JSON.stringify({ emailVo, phoneVo, slugVo, enumVo, dateVo, coordsVo, urlVo }))).toEqual({
      emailVo: "dev@example.com",
      phoneVo: "+14155552671",
      slugVo: "my-slug",
      enumVo: "published",
      dateVo: "2026-05-01T12:00:00.000Z",
      coordsVo: { latitude: 37.7749, longitude: -122.4194 },
      urlVo: "https://example.com/original",
    });
    expect(String(emailVo)).toBe("dev@example.com");
    expect(String(enumVo)).toBe("published");
    expect(String(urlVo)).toBe("https://example.com/original");

    // Verify non-string coercion guards and invalid Date/URL bounds
    expect(new TestEmailVO(["dev@example.com"] as unknown as string).isValid).toBe(false);
    expect(new TestPhoneVO(["+14155552671"] as unknown as string).isValid).toBe(false);
    expect(new TestSlugVO(["valid-slug"] as unknown as string).isValid).toBe(false);
    expect(new TestHtmlVO(["<p>hi</p>"] as unknown as string).isValid).toBe(false);
    expect(new TestMarkdownVO(["# title"] as unknown as string).isValid).toBe(false);
    expect(new TestUrlVO("https://example.com" as unknown as URL).isValid).toBe(false);
    expect(new TestDateVO(new Date("2026-05-01T00:00:00.000Z"), new Date("invalid")).isValid).toBe(false);

    // Criteria deep filter value isolation
    const statusList = ["open", "pending"];
    const criteria = Criteria.none().where("status", "IN", statusList);
    statusList.push("closed");
    expect(criteria.filters[0]?.value).toEqual(["open", "pending"]);

    const criteriaPrims = criteria.toPrimitives();
    (criteriaPrims.filters[0]?.value as string[]).push("tampered");
    expect(criteria.filters[0]?.value).toEqual(["open", "pending"]);

    // Command, Query, and DomainEvent metadata/payload isolation
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

  it("supports InMemoryDAO Date/ISO-string filters, SQL LIKE wildcards, and null-safe ordering, plus RBACPolicy domain User/isolation and Saga terminal failure guard", async () => {
    // 1. InMemoryDAO Date vs ISO-string filtering, LIKE wildcards, and null-safe ordering
    class DaoItemId extends UUIDValue {
      readonly attributeName = "id";
    }
    interface DaoItemModel {
      id: string;
      name: string;
      occurredAt: string;
      rank: number | null;
      createdAt: string;
      updatedAt: string;
    }
    class DaoItemEntity extends Entity<DaoItemId, DaoItemModel> {
      constructor(
        id: DaoItemId,
        public name: string,
        public occurredAt: string,
        public rank: number | null,
      ) {
        super(id, "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
      }
      protected createId(rawId: string | DaoItemId): DaoItemId {
        return rawId instanceof DaoItemId ? rawId : new DaoItemId(rawId);
      }
      toPrimitives(): DaoItemModel {
        return {
          id: this.id.value,
          name: this.name,
          occurredAt: this.occurredAt,
          rank: this.rank,
          createdAt: this.createdAt,
          updatedAt: this.updatedAt,
        };
      }
    }

    const dao = new InMemoryDAO<DaoItemModel, DaoItemEntity>();
    const id1 = "123e4567-e89b-12d3-a456-426614174001";
    const id2 = "123e4567-e89b-12d3-a456-426614174002";
    const id3 = "123e4567-e89b-12d3-a456-426614174003";

    await dao.create(new DaoItemEntity(new DaoItemId(id1), "alpha-service", "2026-05-01T00:00:00.000Z", null));
    await dao.create(new DaoItemEntity(new DaoItemId(id2), "beta-alpha", "2026-05-10T00:00:00.000Z", 20));
    await dao.create(new DaoItemEntity(new DaoItemId(id3), "gamma-core", "2026-05-20T00:00:00.000Z", 5));

    // Date filter against ISO-8601 string in entity primitives
    const byAfterDate = await dao.search(
      Criteria.none().where("occurredAt", "GREATER_THAN", new Date("2026-05-05T00:00:00.000Z")),
    );
    expect(byAfterDate.map((e) => e.id.value)).toEqual([id2, id3]);

    const byBetweenDates = await dao.search(
      Criteria.none().where("occurredAt", "BETWEEN", [
        new Date("2026-05-01T00:00:00.000Z"),
        new Date("2026-05-12T00:00:00.000Z"),
      ]),
    );
    expect(byBetweenDates.map((e) => e.id.value)).toEqual([id1, id2]);

    // Anchored SQL LIKE wildcards vs plain substring LIKE
    const prefixAlpha = await dao.search(Criteria.none().where("name", "LIKE", "alpha%"));
    expect(prefixAlpha.map((e) => e.id.value)).toEqual([id1]);

    const substringAlpha = await dao.search(Criteria.none().where("name", "LIKE", "alpha"));
    expect(substringAlpha.map((e) => e.id.value)).toEqual([id1, id2]);

    // Null-safe ordering (nulls placed consistently last)
    const orderedByRank = await dao.search(Criteria.none().orderBy("rank", "ASC"));
    expect(orderedByRank.map((e) => e.id.value)).toEqual([id3, id2, id1]);

    // 2. RBACPolicy with domain User (UUIDValue id), empty predicates in canAnyWithAttributes, and StaticRBACPolicy isolation
    const rawPerms = [{ resource: "orders", action: "read" as const }];
    const policy = new StaticRBACPolicy({ viewer: rawPerms });
    rawPerms.push({ resource: "orders", action: "delete" as any });
    policy.getPermissions("viewer").push({ resource: "orders", action: "update" as any });

    expect(policy.can("viewer", "delete", "orders")).toBe(false);
    expect(policy.can("viewer", "update", "orders")).toBe(false);

    const domainUser = { id: new DaoItemId(id1) };
    const resource = { name: "orders", ownerId: id1 };
    expect(
      policy.canWithAttributes(domainUser, "viewer", "read", resource, [
        (u, r) => u.id.value === (r as typeof resource).ownerId,
      ]),
    ).toBe(true);
    expect(policy.canAnyWithAttributes(domainUser, "viewer", "read", resource, [])).toBe(true);
    await expect(
      policy.canAnyWithAttributesAsync(domainUser, "viewer", "read", resource, []),
    ).resolves.toBe(true);

    // 3. Saga declarative compensation updateState & non-retried CrossDispatchCycleError in EventBus
    const commandBus = new InMemoryCommandBus();
    const sagaStore = new InMemorySagaStateStore<{ steps: string[]; rolledBack?: boolean }>();

    class CompensationStateSaga extends Saga<{ steps: string[]; rolledBack?: boolean }> {
      constructor() {
        super(commandBus, sagaStore);
      }
      protected getInitialState() {
        return { steps: [] };
      }
      protected getSagaId(event: DomainEvent): string {
        return (event.getPayload() as { id: string }).id;
      }
      protected configure(): void {
        this.registerStepCompensation("step-1", ({ state, updateState }) => {
          updateState({ steps: state.steps.filter((s) => s !== "step-1"), rolledBack: true });
        });
        this.on<TestDomainEvent>(TestDomainEvent.NAME, async (event, ctx) => {
          ctx.updateState({ steps: [...ctx.state.steps, "step-1"] });
          ctx.completeStep("step-1");
          if (event.id === "evt-fail") {
            throw new Error("boom");
          }
        });
      }
    }

    const saga = new CompensationStateSaga();
    await expect(
      saga.handle(new TestDomainEvent("c-1", { id: "s-1" }, { id: "evt-fail" })),
    ).rejects.toThrow("boom");
    const failedState = await sagaStore.load("s-1");
    expect(failedState?.status).toBe("failed");
    expect(failedState?.data).toEqual({ steps: [], rolledBack: true });
    await commandBus.close();
  });

  it("avoids spurious StateManager.subscribeToKey triggers on objects, normalizes RemoteFileToBase64 MIME params/timeout abort/cache, and supports circular SnakeToCamel/PascalCamelToSnake", async () => {
    // 1. StateManager.subscribeToKey deep equality & per-listener isolation
    const stateManager = new InMemoryStateManager({
      user: { name: "Ada", tags: ["core"] },
      counter: 0,
    });
    const userUpdates: Array<{ name: string; tags: string[] }> = [];
    const seenByListener2: number[] = [];

    stateManager.subscribeToKey("user", (u) => {
      userUpdates.push(u);
      u.name = "mutated-by-listener-1";
    });
    stateManager.subscribe((s) => {
      seenByListener2.push(s.counter);
      expect(s.user.name).not.toBe("mutated-by-listener-1");
    });

    // Updating an unrelated key ("counter") must NOT trigger subscribeToKey("user")
    stateManager.setValue("counter", 1);
    stateManager.setValue("counter", 2);
    expect(userUpdates).toHaveLength(0);
    expect(seenByListener2).toEqual([1, 2]);

    // Setting the same deep value for "user" must NOT trigger subscribeToKey("user")
    stateManager.setValue("user", { name: "Ada", tags: ["core"] });
    expect(userUpdates).toHaveLength(0);

    // Changing "user" triggers subscribeToKey("user") once
    stateManager.setValue("user", { name: "Grace", tags: ["core", "compiler"] });
    expect(userUpdates).toHaveLength(1);
    expect(stateManager.getValue("user").name).toBe("Grace");

    // 2. RemoteFileToBase64 MIME parameter matching, timeout abort propagation, & cache isolation
    let getSignalAborted = false;
    const converter = new RemoteFileToBase64({
      get: async (url, options) => {
        if (url.toString().includes("slow")) {
          return await new Promise<any>((_resolve, reject) => {
            options?.signal?.addEventListener(
              "abort",
              () => {
                getSignalAborted = true;
                reject(options.signal?.reason);
              },
              { once: true },
            );
          });
        }
        return new Blob(["charset test"], { type: "TEXT/PLAIN; charset=utf-8" }) as any;
      },
      post: async () => undefined as any,
      put: async () => undefined as any,
      patch: async () => undefined as any,
      delete: async () => undefined as any,
    });

    const res = await converter.convert(new URL("https://cdn.example.com/file.txt"), {
      cache: true,
      expectedMimeTypes: ["text/plain"],
    });
    expect(res.mimeType).toBe("text/plain");
    res.base64 = "mutated";

    const cachedRes = await converter.convert(new URL("https://cdn.example.com/file.txt"), {
      cache: true,
    });
    expect(cachedRes.base64).not.toBe("mutated");

    await expect(
      converter.convert(new URL("https://cdn.example.com/slow.txt"), { timeout: 15 }),
    ).rejects.toThrow("Conversion timeout after 15ms");
    expect(getSignalAborted).toBe(true);

    // 3. SnakeToCamel & PascalCamelToSnake formatting and circular reference handling
    expect(SnakeToCamel.format("USER_NAME")).toBe("userName");
    expect(SnakeToCamel.format("first__name")).toBe("firstName");
    expect(SnakeToCamel.format("alreadyCamel")).toBe("alreadyCamel");

    const circularSnake: Record<string, any> = { first_name: "Alan" };
    circularSnake.self_ref = circularSnake;
    const formattedCamel = SnakeToCamel.formatObject(circularSnake);
    expect(formattedCamel.firstName).toBe("Alan");
    expect(formattedCamel.selfRef).toBe(formattedCamel);

    const formattedBackToSnake = PascalCamelToSnake.formatObject(formattedCamel);
    expect(formattedBackToSnake.first_name).toBe("Alan");
    expect(formattedBackToSnake.self_ref).toBe(formattedBackToSnake);
  });
});
