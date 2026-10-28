import { HTTPProvider, HTTPRequestOptions, HTTPException } from "../http/index.js";
import type { JSONAPIList } from "./json-api-list.js";
import type { JSONAPISingle } from "./json-api-single.js";
import { URLCriteriaBuilder } from "./url-criteria-builder.js";
import { Criteria } from "../criteria/index.js";
import { JSONAPIErrors } from "./exceptions/index.js";

export interface JSONAPIRequestOptions<B = any> extends Omit<HTTPRequestOptions<B>, 'query'> {
  criteria?: Criteria;
  include?: string[];
}

export class JSONAPIConnector {
  constructor(private http: HTTPProvider) { }

  async findOne<A>(
    url: string | URL,
    options?: JSONAPIRequestOptions
  ): Promise<JSONAPISingle<A>> {
    try {
      const targetUrl = this.buildCriteriaUrl(url, options?.criteria, options?.include);

      return await this.http.get(targetUrl, options);
    } catch (error) {
      this.handleError(error);
    }
  }

  async findMany<A>(
    url: string | URL,
    options?: JSONAPIRequestOptions
  ): Promise<JSONAPIList<A>> {
    try {
      const targetUrl = this.buildCriteriaUrl(url, options?.criteria, options?.include);

      return await this.http.get(targetUrl, options);
    } catch (error) {
      this.handleError(error);
    }
  }

  private buildCriteriaUrl(
    url: string | URL,
    criteria?: Criteria,
    include?: string[],
  ): string | URL {
    if (url instanceof URL) {
      return new URLCriteriaBuilder(url, criteria, include).build();
    }
    if (/^https?:\/\//i.test(url)) {
      return new URLCriteriaBuilder(new URL(url), criteria, include).build();
    }

    const dummyBase = new URL("http://localhost");
    const resolved = new URL(url, dummyBase);
    const built = new URLCriteriaBuilder(resolved, criteria, include).build();
    const relativePath = url.startsWith("/") ? built.pathname : built.pathname.replace(/^\//, "");
    return `${relativePath}${built.search}${built.hash}`;
  }

  async create<A>(
    url: string | URL,
    payload: {
      id?: string;
      type: string;
      attributes: Omit<Partial<A>, "id">;
      relationships?: Record<string, any>;
    } | Array<{
      id?: string;
      type: string;
      attributes: Omit<Partial<A>, "id">;
      relationships?: Record<string, any>;
    }>,
    options?: JSONAPIRequestOptions
  ): Promise<JSONAPISingle<A>> {
    try {
      const body = { data: payload };

      return await this.http.post(url, { ...options, body });
    } catch (error) {
      this.handleError(error);
    }
  }

  async update<A>(
    url: string | URL,
    payload: {
      id: string;
      type: string;
      attributes: Omit<Partial<A>, "id">;
      relationships?: Record<string, any>;
    },
    options?: JSONAPIRequestOptions
  ): Promise<JSONAPISingle<A>> {
    try {
      const body = { data: payload };

      return await this.http.patch(url, { ...options, body });
    } catch (error) {
      this.handleError(error);
    }
  }

  async delete(
    url: string | URL,
    options?: JSONAPIRequestOptions
  ): Promise<void> {
    try {
      await this.http.delete(url, options);
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof HTTPException && error.body?.errors) {
      throw new JSONAPIErrors(error.body.errors);
    }

    throw error;
  }
}
