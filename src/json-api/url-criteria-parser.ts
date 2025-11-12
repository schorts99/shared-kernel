import { Criteria } from "../criteria";
import { Direction } from "../criteria/direction";
import { Operator } from "../criteria/operator";

export class URLCriteriaParser {
  constructor(
    private readonly url: URL,
    private readonly allowedKeys: Array<string> = [],
  ) {}

  parse(): Criteria {
    const criteria = new Criteria();
    const params = this.url.searchParams;

    for (const [key, value] of params.entries()) {
      if (!this.allowedKeys.includes(key) && this.allowedKeys.length > 0) continue;

      const match = key.match(/^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/);

      if (!match) continue;

      const [, field, op] = match;
      const operator = this.mapOperator(op);
      const parsedValue = this.parseValue(operator, value);

      criteria.where(field!, operator, parsedValue);
    }

    const sortParam = params.get("sort");

    if (sortParam) {
      sortParam.split(",").forEach((part) => {
        const direction: Direction = part.startsWith("-") ? "DESC" : "ASC";
        const field = part.replace(/^-/, "");
        criteria.orderBy(field, direction);
      });
    }

    const limit = params.get("page[limit]");
    if (limit) criteria.limitResults(Number(limit));

    const offset = params.get("page[offset]");
    if (offset) criteria.offsetResults(Number(offset));

    return criteria;
  }

  private mapOperator(op?: string): Operator {
    switch (op) {
      case undefined: return "EQUAL";
      case "ne": return "NOT_EQUAL";
      case "gt": return "GREATER_THAN";
      case "lt": return "LESS_THAN";
      case "gte": return "GREATER_THAN_OR_EQUAL";
      case "lte": return "LESS_THAN_OR_EQUAL";
      case "in": return "IN";
      case "nin": return "NOT_IN";
      case "like": return "LIKE";
      case "between": return "BETWEEN";
      case "geo_radius": return "GEO_RADIUS";
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  private parseValue(operator: Operator, raw: string): any {
    const tryParsePrimitive = (val: string): any => {
      const maybeDate = new Date(val);
      if (!isNaN(maybeDate.getTime())) return maybeDate;
      if (!isNaN(Number(val)) && val.trim() !== "") return Number(val);
      return val;
    };

    switch (operator) {
      case "IN":
      case "NOT_IN":
      case "BETWEEN":
        return raw.split(",").map((v) => tryParsePrimitive(v.trim()));

      case "GEO_RADIUS": {
        const [latStr, lngStr, radiusStr] = raw.split(",");
        const center = [parseFloat(latStr!), parseFloat(lngStr!)];
        const radiusInM = parseFloat(radiusStr!);
        return { center, radiusInM };
      }

      default:
        return tryParsePrimitive(raw);
    }
  }
}
