"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONAPIConnector = void 0;
const url_criteria_builder_1 = require("./url-criteria-builder");
class JSONAPIConnector {
    http;
    constructor(http) {
        this.http = http;
    }
    async findOne(url, criteria, include) {
        const fullUrl = new url_criteria_builder_1.URLCriteriaBuilder(url, criteria, include).build();
        return this.http.get(fullUrl);
    }
    async findMany(url, criteria, include) {
        const fullUrl = new url_criteria_builder_1.URLCriteriaBuilder(url, criteria, include).build();
        return this.http.get(fullUrl);
    }
    async create(url, payload) {
        return this.http.post(url, { data: payload });
    }
    async update(url, payload) {
        return this.http.patch(url, { data: payload });
    }
    async delete(url) {
        return this.http.delete(url);
    }
}
exports.JSONAPIConnector = JSONAPIConnector;
//# sourceMappingURL=json-api-connector.js.map