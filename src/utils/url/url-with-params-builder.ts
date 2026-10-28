export type URLParamPrimitive = string | number | boolean | null | undefined;
export type URLParamValue = URLParamPrimitive | Array<URLParamPrimitive>;

export class URLWithParamsBuilder {
  private readonly base: URL;

  constructor(base: URL | string) {
    this.base = new URL(base.toString());
  }

  with(params: Record<string, URLParamValue>): URLWithParamsBuilder {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        this.base.searchParams.delete(key);
      } else if (Array.isArray(value)) {
        this.base.searchParams.delete(key);
        value.forEach(v => {
          if (v !== undefined && v !== null) {
            this.base.searchParams.append(key, String(v));
          }
        });
      } else {
        this.base.searchParams.set(key, String(value));
      }
    });

    return this;
  }

  build(): URL {
    return new URL(this.base.toString());
  }
}
