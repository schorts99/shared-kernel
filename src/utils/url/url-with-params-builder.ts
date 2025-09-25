export class URLWithParamsBuilder {
  constructor(private readonly base: URL) {}

  with(params: Record<string, string | number | boolean | string[] | number[]>): URLWithParamsBuilder {
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => this.base.searchParams.append(key, JSON.stringify(v)));
      } else {
        this.base.searchParams.set(key, JSON.stringify(value));
      }
    });

    return this;
  }

  build(): URL {
    return this.base;
  }
}
