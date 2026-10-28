import {
  Entity,
  EntityJSONAPIMapper,
  InMemoryFileProvider,
  InMemoryTranslationResolver,
  PascalCamelToSnake,
  RemoteFileToBase64,
  SnakeToCamel,
  UUIDValue,
} from "../src";
import {
  registerTestMessages,
} from "./support/fixtures";

beforeAll(registerTestMessages);

describe("9. Formatters, i18n, RemoteFileToBase64, EntityJSONAPIMapper, and InMemoryFileProvider", () => {
  it("preserves Dates in formatters, replaces all i18n placeholders, converts Blobs in Node.js, and maps JSON:API entities bidirectionally", async () => {
    const timestamp = new Date("2026-05-01T12:00:00.000Z");
    const snakeFormatted = PascalCamelToSnake.formatObject({
      userId: "u-1",
      createdAt: timestamp,
      nestedProfile: { firstName: "Ada" },
    });
    expect(snakeFormatted).toEqual({
      user_id: "u-1",
      created_at: timestamp,
      nested_profile: { first_name: "Ada" },
    });
    expect((snakeFormatted as any).created_at).toBeInstanceOf(Date);

    const camelFormatted = SnakeToCamel.formatObject(snakeFormatted);
    expect(camelFormatted).toEqual({
      userId: "u-1",
      createdAt: timestamp,
      nestedProfile: { firstName: "Ada" },
    });
    expect(camelFormatted.createdAt).toBeInstanceOf(Date);

    // i18n repeated placeholder replacement
    const resolver = new InMemoryTranslationResolver({
      greeting: "Hello {name}, welcome back {name}!",
    });
    expect(resolver.resolve("greeting", { name: "Grace" })).toBe(
      "Hello Grace, welcome back Grace!",
    );

    // RemoteFileToBase64 in Node.js (without FileReader)
    const converter = new RemoteFileToBase64({
      get: async () => new Blob(["hello world"], { type: "text/plain" }) as any,
      post: async () => undefined as any,
      put: async () => undefined as any,
      patch: async () => undefined as any,
      delete: async () => undefined as any,
    });

    const converted = await converter.convert(new URL("https://cdn.example.com/hello.txt"), {
      cache: true,
      expectedMimeTypes: ["text/*"],
    });
    expect(converted.mimeType).toBe("text/plain");
    expect(converted.base64).toBe(
      `data:text/plain;base64,${Buffer.from("hello world").toString("base64")}`,
    );
    expect(converted.cached).toBe(false);

    const cachedConverted = await converter.convert(new URL("https://cdn.example.com/hello.txt"), {
      cache: true,
    });
    expect(cachedConverted.cached).toBe(true);

    // Bidirectional EntityJSONAPIMapper without mutating toPrimitives()
    const internalModel = {
      id: "123e4567-e89b-12d3-a456-426614174099",
      total: 320,
      items: ["book", "pen"],
    };

    class MappedOrderEntity extends Entity<UUIDValue, typeof internalModel> {
      constructor(
        id: UUIDValue,
        public total: number,
        public items: string[],
      ) {
        super(id);
      }

      protected createId(rawId: string): UUIDValue {
        return UUIDValue.fromPrimitives(rawId);
      }

      toPrimitives() {
        return internalModel;
      }

      restoreFromPrimitives(data: typeof internalModel): void {
        this.total = data.total;
        this.items = [...data.items];
      }
    }

    const mapper = new EntityJSONAPIMapper<typeof internalModel, MappedOrderEntity>(
      "orders",
      MappedOrderEntity,
    );
    const entity = new MappedOrderEntity(
      new UUIDValue(internalModel.id),
      internalModel.total,
      internalModel.items,
    );

    const jsonApiDoc = mapper.mapEntity(entity);
    expect(internalModel.id).toBe("123e4567-e89b-12d3-a456-426614174099");
    expect(jsonApiDoc).toEqual({
      data: {
        type: "orders",
        id: "123e4567-e89b-12d3-a456-426614174099",
        attributes: {
          total: 320,
          items: ["book", "pen"],
        },
      },
    });

    const roundTripEntity = mapper.toEntity(jsonApiDoc);
    expect(roundTripEntity).toBeInstanceOf(MappedOrderEntity);
    expect(roundTripEntity.id.value).toBe("123e4567-e89b-12d3-a456-426614174099");
    expect(roundTripEntity.total).toBe(320);
    expect(roundTripEntity.items).toEqual(["book", "pen"]);

    // InMemoryFileProvider
    const fileProvider = new InMemoryFileProvider({ baseUrl: "https://cdn.example.com" });
    const uploadedKey = await fileProvider.upload(
      Buffer.from("file-contents"),
      "/invoices/2026/",
      "inv-001.txt",
      { contentType: "text/plain" },
    );
    expect(uploadedKey).toBe("invoices/2026/inv-001.txt");
    expect(await fileProvider.exists("invoices/2026", "inv-001.txt")).toBe(true);
    expect((await fileProvider.get("invoices/2026/inv-001.txt")).toString("utf8")).toBe(
      "file-contents",
    );
    expect(await fileProvider.list("invoices/")).toEqual(["invoices/2026/inv-001.txt"]);
    expect(fileProvider.getPublicURL("invoices/2026", "inv-001.txt")).toBe(
      "https://cdn.example.com/invoices/2026/inv-001.txt",
    );
    await fileProvider.delete("invoices/2026", "inv-001.txt");
    expect(await fileProvider.exists("invoices/2026", "inv-001.txt")).toBe(false);
  });
});
