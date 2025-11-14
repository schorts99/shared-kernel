import { HTTPProvider, HTTPException } from "../http";
import type { JSONAPIList } from "./json-api-list";
import type { JSONAPISingle } from "./json-api-single";
import { URLCriteriaBuilder } from "./url-criteria-builder";
import { Criteria } from "../criteria";
import { JSONAPIErrors } from "./exceptions";

export class JSONAPIConnector {
  constructor(private http: HTTPProvider) {}

  async findOne<EntityAttributes>(
    url: URL,
    criteria?: Criteria,
    include?: string[]
  ): Promise<JSONAPISingle<EntityAttributes>> {
    try {
      const fullUrl = new URLCriteriaBuilder(url, criteria, include).build();

      return await this.http.get(fullUrl);
    } catch(error) {
      this.handleError(error);
    }
  }

  async findMany<EntityAttributes>(
    url: URL,
    criteria?: Criteria,
    include?: string[]
  ): Promise<JSONAPIList<EntityAttributes>> {
    try {
      const fullUrl = new URLCriteriaBuilder(url, criteria, include).build();

      return await this.http.get(fullUrl);
    } catch(error) {
      this.handleError(error);
    }
  }

  async create<EntityAttributes>(
    url: URL,
    payload: {
      id: string;
      type: string;
      attributes: Omit<Partial<EntityAttributes>, "id">;
    } | Array<{
      id: string;
      type: string;
      attributes: Omit<Partial<EntityAttributes>, "id">;
    }>,
    meta?: Record<string, any>,
  ): Promise<JSONAPISingle<EntityAttributes>> {
    try {
      const body: Record<string, any> = { data: payload };

      if (meta) {
        body["meta"] = meta;
      }

      return await this.http.post(url, body);
    } catch(error) {
      this.handleError(error);
    }
  }

  async update<EntityAttributes>(
    url: URL,
    payload: {
      id: string;
      type: string;
      attributes: Omit<Partial<EntityAttributes>, "id">;
    }
  ): Promise<JSONAPISingle<EntityAttributes>> {
    try {
      return await this.http.patch(url, { data: payload });
    } catch(error) {
      this.handleError(error);
    }
  }

  async delete<EntityAttributes, RequestBody = undefined>(
    url: URL,
    body?: RequestBody,
  ): Promise<JSONAPISingle<EntityAttributes>> {
    try {
      return await this.http.delete(url, body);
    } catch(error) {
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
