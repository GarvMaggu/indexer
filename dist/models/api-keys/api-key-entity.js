"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyEntity = exports.ApiKeyPermission = void 0;
var ApiKeyPermission;
(function (ApiKeyPermission) {
    ApiKeyPermission["override_collection_refresh_cool_down"] = "override_collection_refresh_cool_down";
    ApiKeyPermission["assign_collection_to_community"] = "assign_collection_to_community";
})(ApiKeyPermission = exports.ApiKeyPermission || (exports.ApiKeyPermission = {}));
class ApiKeyEntity {
    constructor(params) {
        this.key = params.key;
        this.appName = params.app_name;
        this.website = params.website;
        this.email = params.email;
        this.createdAt = params.created_at;
        this.active = Boolean(params.active);
        this.tier = Number(params.tier);
        this.permissions = params.permissions;
    }
}
exports.ApiKeyEntity = ApiKeyEntity;
//# sourceMappingURL=api-key-entity.js.map