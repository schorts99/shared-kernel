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

      return this.http.get(fullUrl);
    } catch(error) {
      if (error instanceof HTTPException && error.body) {
        throw new JSONAPIErrors(error.body['errors']);
      }

      throw error;
    }
  }

  async findMany<EntityAttributes>(
    url: URL,
    criteria?: Criteria,
    include?: string[]
  ): Promise<JSONAPIList<EntityAttributes>> {
    try {
      const fullUrl = new URLCriteriaBuilder(url, criteria, include).build();

      return this.http.get(fullUrl);
    } catch(error) {
      if (error instanceof HTTPException && error.body) {
        throw new JSONAPIErrors(error.body['errors']);
      }

      throw error;
    }
  }

  async create<EntityAttributes>(
    url: URL,
    payload: {
      type: string;
      attributes: Omit<Partial<EntityAttributes>, "id">;
    }
  ): Promise<JSONAPISingle<EntityAttributes>> {
    try {
      return this.http.post(url, { data: payload });
    } catch(error) {
      if (error instanceof HTTPException && error.body) {
        throw new JSONAPIErrors(error.body['errors']);
      }

      throw error;
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
      return this.http.patch(url, { data: payload });
    } catch(error) {
      if (error instanceof HTTPException && error.body) {
        throw new JSONAPIErrors(error.body['errors']);
      }

      throw error;
    }
  }

  async delete<EntityAttributes>(
    url: URL
  ): Promise<JSONAPISingle<EntityAttributes>> {
    try {
      return this.http.delete(url);
    } catch(error) {
      if (error instanceof HTTPException && error.body) {
        throw new JSONAPIErrors(error.body['errors']);
      }

      throw error;
    }
  }
}
