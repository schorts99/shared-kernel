import {
  ArrayValue,
  ObjectValue,
  slugify,
  SlugValue,
} from "../../src";

describe("ObjectValue and ArrayValue", () => {
  it("treat { required: false } fields as optional and compare independent of key order", () => {
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
  });

  it("clone caller input before freezing", () => {
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
  });

  it("accept optional arrays and typed arrays, and slugify output is a valid SlugValue", () => {
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
  });
});
