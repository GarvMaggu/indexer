"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitRuleEntity = void 0;
class RateLimitRuleEntity {
    constructor(params) {
        this.id = params.id;
        this.route = params.route;
        this.method = params.method;
        this.tier = params.tier;
        this.apiKey = params.api_key;
        this.options = params.options;
        this.createdAt = params.created_at;
    }
}
exports.RateLimitRuleEntity = RateLimitRuleEntity;
//# sourceMappingURL=rate-limit-rule-entity.js.map