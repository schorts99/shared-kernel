"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Criteria = void 0;
const exceptions_1 = require("./exceptions");
class Criteria {
    filters = {};
    orders = [];
    limit;
    offset;
    where(field, operator, value) {
        this.filters[field] = { value, operator };
        return this;
    }
    orderBy(field, direction = "ASC") {
        this.orders.push({ field, direction });
        return this;
    }
    limitResults(limit) {
        if (limit < 1) {
            throw new exceptions_1.LimitNotValid(limit);
        }
        this.limit = limit;
        return this;
    }
    offsetResults(offset) {
        if (offset < 1) {
            throw new exceptions_1.OffsetNotValid(offset);
        }
        this.offset = offset;
        return this;
    }
}
exports.Criteria = Criteria;
//# sourceMappingURL=criteria.js.map