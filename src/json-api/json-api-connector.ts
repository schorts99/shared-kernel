import { HTTPProvider, HTTPRequestOptions, HTTPException } from "../http";
import type { JSONAPIList } from "./json-api-list";
import type { JSONAPISingle } from "./json-api-single";
import { URLCriteriaBuilder } from "./url-criteria-builder";
import { Criteria } from "../criteria";
import { JSONAPIErrors } from "./exceptions";

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
      const fullUrl = new URLCriteriaBuilder(
        url instanceof URL ? url : new URL(url),
        options?.criteria,
        options?.include
      ).build();

      return await this.http.get(fullUrl, options);
    } catch (error) {
      this.handleError(error);
    }
  }

  async findMany<A>(
    url: string | URL,
    options?: JSONAPIRequestOptions
  ): Promise<JSONAPIList<A>> {
    try {
      const fullUrl = new URLCriteriaBuilder(
        url instanceof URL ? url : new URL(url),
        options?.criteria,
        options?.include
      ).build();

      return await this.http.get(fullUrl, options);
    } catch (error) {
      this.handleError(error);
    }
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
