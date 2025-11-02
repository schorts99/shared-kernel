"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryNotRegistered = void 0;
class QueryNotRegistered extends Error {
    constructor(query, translationResolver) {
        const message = translationResolver
            ? translationResolver.resolve("cqrs.errors.query_not_registered")
            : `Query Not Registered: ${query}`;
        super(message);
    }
}
exports.QueryNotRegistered = QueryNotRegistered;
//# sourceMappingURL=query-not-registered.js.map