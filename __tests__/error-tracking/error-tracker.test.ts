import {
  ErrorTracker,
  InMemoryErrorStore,
  InMemoryLogger,
} from "../../src";
import type { ErrorStore, IgnoredErrorPattern } from "../../src";

class PaymentDeclined extends Error {
  override name = "PaymentDeclined";
}

class CardExpired extends PaymentDeclined {}

class NotAnError {}

function recordingUploader() {
  const batches: string[][] = [];
  return {
    batches,
    uploader: {
      upload: async (errors: Array<{ error: Error | string }>) => {
        batches.push(errors.map(e => (typeof e.error === "string" ? e.error : e.error.message)));
      },
    },
  };
}

describe("ErrorTracker", () => {
  it("caps stored errors in InMemoryErrorStore and uploads tracked errors", async () => {
    const errorStore = new InMemoryErrorStore({ maxErrors: 2 });
    const uploadedBatches: number[] = [];
    const tracker = new ErrorTracker(errorStore, {
      upload: async errors => {
        uploadedBatches.push(errors.length);
      },
    });

    await tracker.track(new Error("err-1"), { step: 1 });
    await tracker.track(new Error("err-2"), { step: 2 });
    await tracker.track(new Error("err-3"), { step: 3 });

    const storedErrors = await errorStore.all();
    expect(storedErrors).toHaveLength(2);
    await tracker.sync();
    expect(uploadedBatches).toEqual([2]);
    expect(await errorStore.all()).toEqual([]);
  });

  it("serializes concurrent sync calls and supports RegExp and predicate ignoredErrors", async () => {
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

  it("matches string patterns against error names, constructor names, messages, and string errors", async () => {
    const store = new InMemoryErrorStore();
    const { batches, uploader } = recordingUploader();
    const tracker = new ErrorTracker(store, uploader, undefined, {
      ignoredErrors: ["PaymentDeclined", "CardExpired", "network down", "AbortError"],
    });

    await tracker.track(new PaymentDeclined("by name"));
    await tracker.track(Object.assign(new CardExpired("by constructor name"), { name: "Renamed" }));
    await tracker.track(new Error("request failed: network down"));
    await tracker.track("AbortError: user navigated away");
    await tracker.track(new Error("kept"));
    await tracker.track("also kept");
    await tracker.sync();

    expect(batches).toEqual([["kept", "also kept"]]);
  });

  it("does not let global or sticky RegExp patterns skip matches between checks", async () => {
    const store = new InMemoryErrorStore();
    const { batches, uploader } = recordingUploader();
    const tracker = new ErrorTracker(store, uploader, undefined, { ignoredErrors: [/timeout/gy, /^Chunk/g] });

    await tracker.track("timeout while loading");
    await tracker.track("timeout while saving");
    await tracker.track(new Error("ChunkLoadError"));
    await tracker.track(new Error("ChunkLoadError again"));
    await tracker.track(Object.assign(new Error("by name"), { name: "Chunky" }));
    await tracker.track(new Error("kept"));
    await tracker.sync();

    expect(batches).toEqual([["kept"]]);
  });

  it("matches Error subclass patterns with instanceof and tolerates non-Error classes", async () => {
    const store = new InMemoryErrorStore();
    const { batches, uploader } = recordingUploader();
    // A non-Error class is only possible from untyped callers; it must not throw.
    const notAnError = NotAnError as unknown as IgnoredErrorPattern;
    const tracker = new ErrorTracker(store, uploader, undefined, { ignoredErrors: [PaymentDeclined, notAnError] });

    await tracker.track(new CardExpired("subclass of an ignored class"));
    await tracker.track(new PaymentDeclined("ignored class"));
    await tracker.track(new Error("kept"));
    await tracker.track("PaymentDeclined as a string is kept");
    await tracker.sync();

    expect(batches).toEqual([["kept", "PaymentDeclined as a string is kept"]]);
  });

  it("logs instead of throwing when storing or uploading fails, and keeps errors that failed to upload", async () => {
    const logger = new InMemoryLogger();
    const failingStore: ErrorStore = {
      add: async () => { throw new Error("disk full"); },
      all: async () => [],
      remove: async () => {},
      clear: async () => {},
    };
    await expect(new ErrorTracker(failingStore, { upload: async () => {} }, logger).track(new Error("x"), { a: 1 }, "why")).resolves.toBeUndefined();

    const store = new InMemoryErrorStore();
    const tracker = new ErrorTracker(store, { upload: async () => { throw new Error("offline"); } }, logger);
    await tracker.track(new Error("pending"));
    await expect(tracker.sync()).resolves.toBeUndefined();

    expect(logger.getByLevel("error").map(e => [e.message, e.error?.message])).toEqual([
      ["[ErrorTracker track] Failed to store tracked error", "disk full"],
      ["[ErrorTracker sync] Failed to sync tracked errors", "offline"],
    ]);
    expect(logger.getByLevel("error")[0]?.context).toEqual({ context: { a: 1 }, reason: "why" });
    expect(await store.all()).toHaveLength(1);
  });

  it("skips the upload when nothing is pending", async () => {
    const upload = jest.fn(async () => {});
    await new ErrorTracker(new InMemoryErrorStore(), { upload }).sync();

    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects an invalid InMemoryErrorStore size", () => {
    expect(() => new InMemoryErrorStore({ maxErrors: 0 })).toThrow(RangeError);
    expect(() => new InMemoryErrorStore({ maxErrors: 1.5 })).toThrow(RangeError);
  });
});
