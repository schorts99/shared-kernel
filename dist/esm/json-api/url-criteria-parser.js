"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URLCriteriaParser = void 0;
const criteria_1 = require("../criteria");
class URLCriteriaParser {
    url;
    allowedKeys;
    constructor(url, allowedKeys = []) {
        this.url = url;
        this.allowedKeys = allowedKeys;
    }
    parse() {
        const criteria = new criteria_1.Criteria();
        const params = this.url.searchParams;
        for (const [key, value] of params.entries()) {
            if (!this.allowedKeys.includes(key) && this.allowedKeys.length > 0)
                continue;
            const match = key.match(/^filter\[([^\]]+)\](?:\[([^\]]+)\])?$/);
            if (!match)
                continue;
            const [, field, op] = match;
            const operator = this.mapOperator(op);
            const parsedValue = this.parseValue(operator, value);
            criteria.where(field, operator, parsedValue);
        }
        const sortParam = params.get("sort");
        if (sortParam) {
            sortParam.split(",").forEach((part) => {
                const direction = part.startsWith("-") ? "DESC" : "ASC";
                const field = part.replace(/^-/, "");
                criteria.orderBy(field, direction);
            });
        }
        const limit = params.get("page[limit]");
        if (limit)
            criteria.limitResults(Number(limit));
        const offset = params.get("page[offset]");
        if (offset)
            criteria.offsetResults(Number(offset));
        return criteria;
    }
    mapOperator(op) {
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
    parseValue(operator, raw) {
        const tryParsePrimitive = (val) => {
            const maybeDate = new Date(val);
            if (!isNaN(maybeDate.getTime()))
                return maybeDate;
            if (!isNaN(Number(val)) && val.trim() !== "")
                return Number(val);
            return val;
        };
        switch (operator) {
            case "IN":
            case "NOT_IN":
            case "BETWEEN":
                return raw.split(",").map((v) => tryParsePrimitive(v.trim()));
            case "GEO_RADIUS": {
                const [latStr, lngStr, radiusStr] = raw.split(",");
                const center = [parseFloat(latStr), parseFloat(lngStr)];
                const radiusInM = parseFloat(radiusStr);
                return { center, radiusInM };
            }
            default:
                return tryParsePrimitive(raw);
        }
    }
}
exports.URLCriteriaParser = URLCriteriaParser;
//# sourceMappingURL=url-criteria-parser.js.map