import {
  retry,
} from "../../src";

describe("retry", () => {
  it("retries with backoff options and shouldRetry", async () => {
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
});
