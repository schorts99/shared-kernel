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
            return this.http.get(fullUrl);
        }
        catch (error) {
            if (error instanceof http_1.HTTPException && error.body) {
                throw new exceptions_1.JSONAPIErrors(error.body['errors']);
            }
            throw error;
        }
    }
    async findMany(url, criteria, include) {
        try {
            const fullUrl = new url_criteria_builder_1.URLCriteriaBuilder(url, criteria, include).build();
            return this.http.get(fullUrl);
        }
        catch (error) {
            if (error instanceof http_1.HTTPException && error.body) {
                throw new exceptions_1.JSONAPIErrors(error.body['errors']);
            }
            throw error;
        }
    }
    async create(url, payload) {
        try {
            return this.http.post(url, { data: payload });
        }
        catch (error) {
            if (error instanceof http_1.HTTPException && error.body) {
                throw new exceptions_1.JSONAPIErrors(error.body['errors']);
            }
            throw error;
        }
    }
    async update(url, payload) {
        try {
            return this.http.patch(url, { data: payload });
        }
        catch (error) {
            if (error instanceof http_1.HTTPException && error.body) {
                throw new exceptions_1.JSONAPIErrors(error.body['errors']);
            }
            throw error;
        }
    }
    async delete(url) {
        try {
            return this.http.delete(url);
        }
        catch (error) {
            if (error instanceof http_1.HTTPException && error.body) {
                throw new exceptions_1.JSONAPIErrors(error.body['errors']);
            }
            throw error;
        }
    }
}
exports.JSONAPIConnector = JSONAPIConnector;
//# sourceMappingURL=json-api-connector.js.map