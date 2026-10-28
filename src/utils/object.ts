export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as any;

  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });

  return result as Pick<T, K>;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj } as any;

  keys.forEach((key) => {
    delete result[key];
  });

  return result as Omit<T, K>;
}

export function isObject(value: any): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasAllKeys<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): obj is T & Record<K, unknown> {
  return keys.every((key) => key in obj);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (
    a !== null &&
    b !== null &&
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function createDataCloneError(message: string): DOMException {
  return new DOMException(message, "DataCloneError");
}

function isUnsupportedObject(value: object): boolean {
  return (
    value instanceof Promise ||
    value instanceof WeakMap ||
    value instanceof WeakSet ||
    (typeof WeakRef !== "undefined" && value instanceof WeakRef) ||
    (typeof FinalizationRegistry !== "undefined" && value instanceof FinalizationRegistry)
  );
}

function cloneInner<T>(value: T, seen: WeakMap<object, unknown>): T {
  if (value === null || value === undefined) {
    return value;
  }

  const valueType = typeof value;
  if (valueType === "boolean" || valueType === "number" || valueType === "bigint" || valueType === "string") {
    return value;
  }

  if (valueType === "function" || valueType === "symbol") {
    throw createDataCloneError(`Unsupported value of type '${valueType}' cannot be cloned`);
  }

  if (valueType !== "object") {
    throw createDataCloneError(`Unsupported value of type '${valueType}' cannot be cloned`);
  }

  const obj = value as unknown as object;
  if (isUnsupportedObject(obj)) {
    throw createDataCloneError(`Unsupported object '${obj.constructor?.name ?? "Object"}' cannot be cloned`);
  }

  if (seen.has(obj)) {
    return seen.get(obj) as T;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof RegExp) {
    const copy = new RegExp(obj.source, obj.flags);
    copy.lastIndex = obj.lastIndex;
    return copy as unknown as T;
  }

  if (obj instanceof URL) {
    return new URL(obj.toString()) as unknown as T;
  }

  if (obj instanceof URLSearchParams) {
    return new URLSearchParams(obj.toString()) as unknown as T;
  }

  if (obj instanceof ArrayBuffer) {
    const copy = obj.slice(0);
    seen.set(obj, copy);
    return copy as unknown as T;
  }

  if (typeof SharedArrayBuffer !== "undefined" && obj instanceof SharedArrayBuffer) {
    return structuredClone(obj) as unknown as T;
  }

  if (obj instanceof DataView) {
    const bufferCopy = cloneInner(obj.buffer, seen);
    const copy = new DataView(bufferCopy, obj.byteOffset, obj.byteLength);
    seen.set(obj, copy);
    return copy as unknown as T;
  }

  if (ArrayBuffer.isView(obj)) {
    const view = obj as ArrayBufferView & { length?: number };
    const bufferCopy = cloneInner(view.buffer, seen);
    const Ctor = view.constructor as new (
      buffer: ArrayBufferLike,
      byteOffset: number,
      length?: number,
    ) => ArrayBufferView;
    const copy = view.length !== undefined
      ? new Ctor(bufferCopy, view.byteOffset, view.length)
      : new Ctor(bufferCopy, view.byteOffset);
    seen.set(obj, copy);
    return copy as unknown as T;
  }

  if (obj instanceof Map) {
    const copy = new Map();
    seen.set(obj, copy);
    for (const [k, v] of obj.entries()) {
      copy.set(cloneInner(k, seen), cloneInner(v, seen));
    }
    return copy as unknown as T;
  }

  if (obj instanceof Set) {
    const copy = new Set();
    seen.set(obj, copy);
    for (const v of obj.values()) {
      copy.add(cloneInner(v, seen));
    }
    return copy as unknown as T;
  }

  if (Array.isArray(obj)) {
    const copy = new Array(obj.length);
    seen.set(obj, copy);
    const descriptors = Object.getOwnPropertyDescriptors(obj);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (key === "length") continue;
      const desc = descriptors[key as keyof typeof descriptors]!;
      if ("value" in desc) {
        Object.defineProperty(copy, key, {
          ...desc,
          value: cloneInner(desc.value, seen),
        });
      } else {
        Object.defineProperty(copy, key, desc);
      }
    }
    if (Object.isFrozen(obj)) Object.freeze(copy);
    else if (Object.isSealed(obj)) Object.seal(copy);
    else if (!Object.isExtensible(obj)) Object.preventExtensions(copy);
    return copy as unknown as T;
  }

  if (typeof (obj as { clone?: unknown }).clone === "function" && (obj as { clone: Function }).clone.length === 0) {
    const customClone = (obj as { clone: () => T }).clone();
    seen.set(obj, customClone);
    return customClone;
  }

  const proto = Object.getPrototypeOf(obj);
  const copy = Object.create(proto);
  seen.set(obj, copy);

  const descriptors = Object.getOwnPropertyDescriptors(obj);
  for (const key of Reflect.ownKeys(descriptors)) {
    const desc = descriptors[key as keyof typeof descriptors]!;
    if ("value" in desc) {
      Object.defineProperty(copy, key, {
        ...desc,
        value: cloneInner(desc.value, seen),
      });
    } else {
      Object.defineProperty(copy, key, desc);
    }
  }

  if (Object.isFrozen(obj)) Object.freeze(copy);
  else if (Object.isSealed(obj)) Object.seal(copy);
  else if (!Object.isExtensible(obj)) Object.preventExtensions(copy);

  return copy as T;
}

/**
 * Deep-clones plain values and domain class instances while preserving prototypes.
 * Rejects functions, symbols, WeakMaps, WeakSets, Promises, and other non-cloneable values
 * with a `DataCloneError` `DOMException`.
 */
export function cloneValue<T>(value: T): T {
  return cloneInner(value, new WeakMap<object, unknown>());
}

