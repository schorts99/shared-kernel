import { HTTPProvider } from "../http";
import type { JSONAPIList } from "./json-api-list";
import type { JSONAPISingle } from "./json-api-single";
import { Criteria } from "../criteria";
export declare class JSONAPIConnector {
    private http;
    constructor(http: HTTPProvider);
    findOne<EntityAttributes>(url: URL, criteria?: Criteria, include?: string[]): Promise<JSONAPISingle<EntityAttributes>>;
    findMany<EntityAttributes>(url: URL, criteria?: Criteria, include?: string[]): Promise<JSONAPIList<EntityAttributes>>;
    create<EntityAttributes>(url: URL, payload: {
        type: string;
        attributes: Omit<Partial<EntityAttributes>, "id">;
    }): Promise<JSONAPISingle<EntityAttributes>>;
    update<EntityAttributes>(url: URL, payload: {
        id: string;
        type: string;
        attributes: Omit<Partial<EntityAttributes>, "id">;
    }): Promise<JSONAPISingle<EntityAttributes>>;
    delete<EntityAttributes>(url: URL): Promise<JSONAPISingle<EntityAttributes>>;
}
//# sourceMappingURL=json-api-connector.d.ts.map