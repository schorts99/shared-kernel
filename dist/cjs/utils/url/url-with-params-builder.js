"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URLWithParamsBuilder = void 0;
class URLWithParamsBuilder {
    base;
    constructor(base) {
        this.base = base;
    }
    with(params) {
        Object.entries(params).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => this.base.searchParams.append(key, String(v)));
            }
            else {
                this.base.searchParams.set(key, String(value));
            }
        });
        return this;
    }
    build() {
        return this.base;
    }
}
exports.URLWithParamsBuilder = URLWithParamsBuilder;
//# sourceMappingURL=url-with-params-builder.js.map