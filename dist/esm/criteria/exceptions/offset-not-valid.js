"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OffsetNotValid = void 0;
class OffsetNotValid extends Error {
    constructor(offset, translationResolver) {
        const message = translationResolver
            ? translationResolver.resolve("criteria.errors.offset_not_valid", { offset })
            : `Offset Not Valid: ${offset}`;
        super(message);
    }
}
exports.OffsetNotValid = OffsetNotValid;
//# sourceMappingURL=offset-not-valid.js.map