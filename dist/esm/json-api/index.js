"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONAPIConnector = exports.URLCriteriaBuilder = void 0;
var url_criteria_builder_1 = require("./url-criteria-builder");
Object.defineProperty(exports, "URLCriteriaBuilder", { enumerable: true, get: function () { return url_criteria_builder_1.URLCriteriaBuilder; } });
var json_api_connector_1 = require("./json-api-connector");
Object.defineProperty(exports, "JSONAPIConnector", { enumerable: true, get: function () { return json_api_connector_1.JSONAPIConnector; } });
__exportStar(require("./exceptions"), exports);
//# sourceMappingURL=index.js.map