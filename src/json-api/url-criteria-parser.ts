import { Criteria } from "../criteria/index.js";
import { Direction } from "../criteria/direction.js";
import { Operator } from "../criteria/operator.js";

export class URLCriteriaParser {
  constructor(
    private readonly url: URL,
    private readonly allowedKeys: Array<string> = [],
  ) {}

  parse(): Criteria {
    let criteria = new Criteria();
    const params = this.url.searchParams;

    for (const [key, value] of params.entries()) {
      const match = key.match(/^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/);

      if (!match) continue;

      const [, field, op] = match;
      if (
        this.allowedKeys.length > 0 &&
        !this.allowedKeys.includes(key) &&
        !this.allowedKeys.includes(field!)
      ) {
        continue;
      }

      const operator = this.mapOperator(op);
      const parsedValue = this.parseValue(operator, value);

      criteria = criteria.where(field!, operator, parsedValue);
    }

    const sortParam = params.get("sort");

    if (sortParam) {
      sortParam.split(",").forEach((part) => {
        const direction: Direction = part.startsWith("-") ? "DESC" : "ASC";
        const field = part.replace(/^-/, "");
        criteria = criteria.orderBy(field, direction);
      });
    }

    const limit = params.get("page[limit]");

    if (limit !== null && limit.trim() !== "") {
      criteria = criteria.limitResults(Number(limit));
    }

    const offset = params.get("page[offset]");

    if (offset !== null && offset.trim() !== "") {
      criteria = criteria.offsetResults(Number(offset));
    }

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
      case "array_contains": return "ARRAY_CONTAINS";
      case "array_contains_any": return "ARRAY_CONTAINS_ANY";
      case "nin": return "NOT_IN";
      case "like": return "LIKE";
      case "between": return "BETWEEN";
      case "geo_radius": return "GEO_RADIUS";
      default: throw new Error(`Unknown operator: ${op}`);
    }
  }

  private parseValue(operator: Operator, raw: string): any {
    const isoDatePattern =
      /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

    const tryParsePrimitive = (val: string): any => {
      const trimmed = val.trim();
      if (trimmed === "true") return true;
      if (trimmed === "false") return false;
      if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
        return Number(trimmed);
      }
      if (isoDatePattern.test(trimmed)) {
        const maybeDate = new Date(trimmed);
        if (!Number.isNaN(maybeDate.getTime())) {
          return maybeDate;
        }
      }

      return val;
    };

    switch (operator) {
      case "IN":
      case "NOT_IN":
      case "BETWEEN":
      case "ARRAY_CONTAINS_ANY":
        return raw.split(",").map((v) => tryParsePrimitive(v.trim()));
      case "GEO_RADIUS": {
        const [latStr, lngStr, radiusStr] = raw.split(",");
        const lat = parseFloat(latStr!);
        const lng = parseFloat(lngStr!);
        const radiusInM = parseFloat(radiusStr!);
        const center = [lat, lng];

        return { center, radiusInM, lat, lng, radius: radiusInM };
      }
      default:
        return tryParsePrimitive(raw);
    }
  }
}
