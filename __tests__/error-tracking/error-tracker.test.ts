import { ErrorTracker, ErrorStore, ErrorUploader, TrackedError } from "../../src/error-tracking";
import { Logger } from "../../src/logger";

describe("ErrorTracker", () => {
  let mockStore: jest.Mocked<ErrorStore>;
  let mockUploader: jest.Mocked<ErrorUploader>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockStore = {
      add: jest.fn(),
      all: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    };

    mockUploader = {
      upload: jest.fn(),
    };

    mockLogger = {
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(),
    } as unknown as jest.Mocked<Logger>;
  });

  describe("track", () => {
    it("should add an error to the store", async () => {
      const tracker = new ErrorTracker(mockStore, mockUploader);
      const error = new Error("Test error");

      await tracker.track(error, { user: "1" }, "test_reason");

      expect(mockStore.add).toHaveBeenCalledWith(error, { user: "1" }, "test_reason");
    });

    it("should ignore errors specified by string match (message, name, or constructor name)", async () => {
      const tracker = new ErrorTracker(mockStore, mockUploader, undefined, {
        ignoredErrors: ["LocationNotFound"]
      });

      const error1 = new Error("LocationNotFound: Could not find user location");
      const error2 = new Error("Something else went wrong");
      const error3 = new Error("Other");
      error3.name = "LocationNotFound";

      await tracker.track(error1);
      await tracker.track(error2);
      await tracker.track(error3);
      await tracker.track("Just a string LocationNotFound error");
      await tracker.track("Another random string error");

      expect(mockStore.add).toHaveBeenCalledTimes(2);
      expect(mockStore.add).toHaveBeenCalledWith(error2, undefined, undefined);
      expect(mockStore.add).toHaveBeenCalledWith("Another random string error", undefined, undefined);
    });

    it("should ignore errors specified by class constructor", async () => {
      class LocationNotFoundError extends Error {
        constructor(message?: string) {
          super(message);
          this.name = "LocationNotFoundError";
        }
      }

      class OtherError extends Error { }

      const tracker = new ErrorTracker(mockStore, mockUploader, undefined, {
        ignoredErrors: [LocationNotFoundError]
      });

      await tracker.track(new LocationNotFoundError("Not found"));
      await tracker.track(new OtherError("Other error"));

      expect(mockStore.add).toHaveBeenCalledTimes(1);
      expect(mockStore.add).toHaveBeenCalledWith(expect.any(OtherError), undefined, undefined);
    });

    it("should log an error if store.add fails", async () => {
      const tracker = new ErrorTracker(mockStore, mockUploader, mockLogger);
      const error = new Error("Test error");
      const storeError = new Error("Store failed");

      mockStore.add.mockRejectedValueOnce(storeError);

      await tracker.track(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ErrorTracker track] Failed to store tracked error",
        { context: undefined, reason: undefined },
        storeError
      );
    });
  });

  describe("sync", () => {
    it("should upload pending errors and remove them from the store", async () => {
      const tracker = new ErrorTracker(mockStore, mockUploader);
      const pendingErrors: TrackedError[] = [
        { id: "1", error: "Error 1", timestamp: new Date() },
        { id: "2", error: "Error 2", timestamp: new Date() },
      ];

      mockStore.all.mockResolvedValueOnce(pendingErrors);

      await tracker.sync();

      expect(mockStore.all).toHaveBeenCalled();
      expect(mockUploader.upload).toHaveBeenCalledWith(pendingErrors);
      expect(mockStore.remove).toHaveBeenCalledWith(["1", "2"]);
    });

    it("should do nothing if there are no pending errors", async () => {
      const tracker = new ErrorTracker(mockStore, mockUploader);
      mockStore.all.mockResolvedValueOnce([]);

      await tracker.sync();

      expect(mockStore.all).toHaveBeenCalled();
      expect(mockUploader.upload).not.toHaveBeenCalled();
      expect(mockStore.remove).not.toHaveBeenCalled();
    });

    it("should log an error if sync fails", async () => {
      const tracker = new ErrorTracker(mockStore, mockUploader, mockLogger);
      const syncError = new Error("Sync failed");

      mockStore.all.mockRejectedValueOnce(syncError);

      await tracker.sync();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ErrorTracker sync] Failed to sync tracked errors",
        {},
        syncError
      );
    });
  });
});
