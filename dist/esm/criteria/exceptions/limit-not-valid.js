"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LimitNotValid = void 0;
class LimitNotValid extends Error {
    constructor(limit, translationResolver) {
        const message = translationResolver
            ? translationResolver.resolve("criteria.errors.limit_not_valid", { limit })
            : `Limit Not Valid: ${limit}`;
        super(message);
    }
}
exports.LimitNotValid = LimitNotValid;
//# sourceMappingURL=limit-not-valid.js.map