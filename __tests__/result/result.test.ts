import {
  Result,
} from "../../src";

describe("Result", () => {
  it("supports async combinators and primitives round-trips", async () => {
    const okFromPromise = await Result.fromPromise(async () => 21);
    const mapped = await okFromPromise
      .mapAsync(async x => x * 2)
      .then(r => r.flatMapAsync(async x => Result.success(`val:${x}`)));

    expect(mapped.isSuccess()).toBe(true);
    expect(mapped.value).toBe("val:42");

    const matchedOk = await mapped.matchAsync(
      async v => `ok(${v})`,
      async err => `err(${err.message})`,
    );
    expect(matchedOk).toBe("ok(val:42)");

    const okPrimitives = mapped.toPrimitives();
    expect(okPrimitives).toEqual({ isSuccess: true, value: "val:42" });
    const restoredOk = Result.fromPrimitives<string>(okPrimitives);
    expect(restoredOk.isSuccess()).toBe(true);
    expect(restoredOk.value).toBe("val:42");

    const failFromPromise = await Result.fromPromise(async () => {
      throw new Error("boom");
    });
    const mappedErr = await failFromPromise.mapErrorAsync(async err => {
      const custom = new Error(`wrapped:${err.message}`);
      custom.name = "CustomDomainError";
      return custom;
    });

    expect(mappedErr.isFailure()).toBe(true);
    const errPrimitives = mappedErr.toPrimitives();
    expect(errPrimitives).toEqual({
      isSuccess: false,
      error: { name: "CustomDomainError", message: "wrapped:boom" },
    });

    const restoredErr = Result.fromPrimitives<never, Error>(errPrimitives);
    expect(restoredErr.isFailure()).toBe(true);
    expect(restoredErr.error).toBeInstanceOf(Error);
    expect(restoredErr.error.name).toBe("CustomDomainError");
    expect(restoredErr.error.message).toBe("wrapped:boom");
  });

  it("fromPromise accepts a promise or factory and normalizes or maps rejections", async () => {
    expect((await Result.fromPromise(Promise.resolve(1))).value).toBe(1);

    const rejectedWithString = await Result.fromPromise(Promise.reject("nope"));
    expect(rejectedWithString.error).toBeInstanceOf(Error);
    expect(rejectedWithString.error.message).toBe("Promise rejected: nope");

    const mapped = await Result.fromPromise(Promise.reject(new Error("boom")), e => ({ code: "E_MAPPED", cause: e }));
    expect(mapped.error.code).toBe("E_MAPPED");
  });

  it("combine collects values or returns the first failure", () => {
    expect(Result.combine([Result.success(1), Result.success(2)]).value).toEqual([1, 2]);

    const first = new Error("first");
    const combined = Result.combine<number>([Result.success(1), Result.error(first), Result.error(new Error("second"))]);
    expect(combined.error).toBe(first);
  });

  it("value and error getters throw on the wrong branch", () => {
    const failure = Result.failure<number, string>("bad input");
    expect(() => failure.value).toThrow("Result failure: bad input");
    expect(() => Result.error<number>(new TypeError("typed")).value).toThrow(TypeError);
    expect(() => Result.success(1).error).toThrow("Cannot get error from a success result");
    expect(failure.getValue()).toBeUndefined();
    expect(failure.getError()).toBe("bad input");
    expect(Result.success(1).getError()).toBeUndefined();
  });

  it("sync combinators transform only their own branch", () => {
    const ok = Result.success<number, string>(2);
    const fail = Result.failure<number, string>("bad");

    expect(ok.map(x => x * 3).value).toBe(6);
    expect(fail.map(x => x * 3).error).toBe("bad");
    expect(ok.flatMap(x => Result.success<string, string>(`n${x}`)).value).toBe("n2");
    expect(fail.flatMap(x => Result.success<string, string>(`n${x}`)).error).toBe("bad");
    expect(ok.mapError(e => e.length).value).toBe(2);
    expect(fail.mapError(e => e.length).error).toBe(3);
    expect(ok.getOrElse(0)).toBe(2);
    expect(fail.getOrElse(0)).toBe(0);
    expect(ok.match(v => `ok:${v}`, e => `err:${e}`)).toBe("ok:2");
    expect(fail.match(v => `ok:${v}`, e => `err:${e}`)).toBe("err:bad");
  });

  it("async combinators pass the other branch through untouched", async () => {
    const fail = Result.failure<number, string>("bad");
    const fn = jest.fn(async (x: number) => x);

    expect((await fail.mapAsync(fn)).error).toBe("bad");
    expect((await fail.flatMapAsync(async x => Result.success<number, string>(x))).error).toBe("bad");
    expect((await Result.success<number, string>(1).mapErrorAsync(async e => e.length)).value).toBe(1);
    expect(await fail.matchAsync(async () => "ok", async e => `err:${e}`)).toBe("err:bad");
    expect(fn).not.toHaveBeenCalled();
  });

  it("onSuccess and onFailure run only on their branch and return the same result", async () => {
    const ok = Result.success<number, string>(1);
    const fail = Result.failure<number, string>("bad");
    const seen: string[] = [];

    expect(ok.onSuccess(v => seen.push(`s${v}`)).onFailure(e => seen.push(`f${e}`))).toBe(ok);
    expect(fail.onSuccess(v => seen.push(`s${v}`)).onFailure(e => seen.push(`f${e}`))).toBe(fail);
    expect(await ok.onSuccessAsync(async v => { seen.push(`as${v}`); })).toBe(ok);
    expect(await ok.onFailureAsync(async e => { seen.push(`af${e}`); })).toBe(ok);
    expect(await fail.onSuccessAsync(async v => { seen.push(`as${v}`); })).toBe(fail);
    expect(await fail.onFailureAsync(async e => { seen.push(`af${e}`); })).toBe(fail);

    expect(seen).toEqual(["s1", "fbad", "as1", "afbad"]);
  });

  it("toPrimitives serializes values and errors that have toPrimitives, error codes, and plain errors", () => {
    const money = { toPrimitives: () => ({ amount: 5 }) };
    expect(Result.success(money).toPrimitives()).toEqual({ isSuccess: true, value: { amount: 5 } });
    expect(Result.success(null).toPrimitives()).toEqual({ isSuccess: true, value: null });

    const domainError = { toPrimitives: () => ({ kind: "OutOfStock" }) };
    expect(Result.failure(domainError).toPrimitives()).toEqual({ isSuccess: false, error: { kind: "OutOfStock" } });

    const coded = Object.assign(new Error("declined"), { code: "E_CARD" });
    expect(Result.failure(coded).toPrimitives()).toEqual({
      isSuccess: false,
      error: { name: "Error", message: "declined", code: "E_CARD" },
    });

    expect(Result.failure("plain").toPrimitives()).toEqual({ isSuccess: false, error: "plain" });
  });

  it("fromPrimitives hydrates with callbacks, restores error codes, and passes other errors through", () => {
    const hydrated = Result.fromPrimitives<Date>(
      { isSuccess: true, value: "2026-01-01T00:00:00.000Z" },
      { hydrateValue: raw => new Date(String(raw)) },
    );
    expect(hydrated.value).toEqual(new Date("2026-01-01T00:00:00.000Z"));

    const hydratedError = Result.fromPrimitives<never, string>(
      { isSuccess: false, error: { kind: "OutOfStock" } },
      { hydrateError: raw => (raw as { kind: string }).kind },
    );
    expect(hydratedError.error).toBe("OutOfStock");

    const withCode = Result.fromPrimitives<never, Error & { code?: unknown }>({
      isSuccess: false,
      error: { name: "PaymentError", message: "declined", code: "E_CARD" },
    });
    expect(withCode.error).toBeInstanceOf(Error);
    expect(withCode.error.name).toBe("PaymentError");
    expect(withCode.error.code).toBe("E_CARD");

    const withoutName = Result.fromPrimitives<never, Error>({ isSuccess: false, error: { message: "no name" } });
    expect(withoutName.error.name).toBe("Error");

    const original = new Error("kept");
    expect(Result.fromPrimitives<never, Error>({ isSuccess: false, error: original }).error).toBe(original);
    expect(Result.fromPrimitives<never, string>({ isSuccess: false, error: "plain" }).error).toBe("plain");
    expect(Result.fromPrimitives<never, unknown>({ isSuccess: false, error: { notAMessage: 1 } }).error).toEqual({ notAMessage: 1 });
  });
});
