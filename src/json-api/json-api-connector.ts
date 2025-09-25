import type { HTTPProvider } from "../http";
import type { JSONAPIList } from "./json-api-list";
import type { JSONAPISingle } from "./json-api-single";
import { URLCriteriaBuilder } from "./url-criteria-builder";
import { Criteria } from "../criteria";

export class JSONAPIConnector {
  constructor(private http: HTTPProvider) {}

  async findOne<EntityAttributes>(
    url: URL,
    criteria?: Criteria,
    include?: string[]
  ): Promise<JSONAPISingle<EntityAttributes>> {
    const fullUrl = new URLCriteriaBuilder(url, criteria, include).build();

    return this.http.get(fullUrl);
  }

  async findMany<EntityAttributes>(
    url: URL,
    criteria?: Criteria,
    include?: string[]
  ): Promise<JSONAPIList<EntityAttributes>> {
    const fullUrl = new URLCriteriaBuilder(url, criteria, include).build();

    return this.http.get(fullUrl);
  }

  async create<EntityAttributes>(
    url: URL,
    payload: {
      type: string;
      attributes: Omit<EntityAttributes, "id">;
    }
  ): Promise<JSONAPISingle<EntityAttributes>> {
    return this.http.post(url, { data: payload });
  }

  async update<EntityAttributes>(
    url: URL,
    payload: {
      id: string;
      type: string;
      attributes: Omit<EntityAttributes, "id">;
    }
  ): Promise<JSONAPISingle<EntityAttributes>> {
    return this.http.patch(url, { data: payload });
  }

  async delete<EntityAttributes>(
    url: URL
  ): Promise<JSONAPISingle<EntityAttributes>> {
    return this.http.delete(url);
  }
}
