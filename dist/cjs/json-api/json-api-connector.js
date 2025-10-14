"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONAPIConnector = void 0;
const http_1 = require("../http");
const url_criteria_builder_1 = require("./url-criteria-builder");
const exceptions_1 = require("./exceptions");
class JSONAPIConnector {
    http;
    constructor(http) {
        this.http = http;
    }
    async findOne(url, criteria, include) {
        try {
            const fullUrl = new url_criteria_builder_1.URLCriteriaBuilder(url, criteria, include).build();
            return await this.http.get(fullUrl);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async findMany(url, criteria, include) {
        try {
            const fullUrl = new url_criteria_builder_1.URLCriteriaBuilder(url, criteria, include).build();
            return await this.http.get(fullUrl);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async create(url, payload) {
        try {
            return await this.http.post(url, { data: payload });
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async update(url, payload) {
        try {
            return await this.http.patch(url, { data: payload });
        }
        catch (error) {
            this.handleError(error);
        }
    }
    async delete(url) {
        try {
            return await this.http.delete(url);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    handleError(error) {
        if (error instanceof http_1.HTTPException && error.body?.errors) {
            throw new exceptions_1.JSONAPIErrors(error.body.errors);
        }
        throw error;
    }
}
exports.JSONAPIConnector = JSONAPIConnector;
//# sourceMappingURL=json-api-connector.js.map