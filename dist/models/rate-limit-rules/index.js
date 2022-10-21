"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitRules = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const lodash_1 = __importDefault(require("lodash"));
const redis_1 = require("@/common/redis");
const db_1 = require("@/common/db");
const rate_limit_rule_entity_1 = require("@/models/rate-limit-rules/rate-limit-rule-entity");
const channels_1 = require("@/pubsub/channels");
const logger_1 = require("@/common/logger");
const api_keys_1 = require("@/models/api-keys");
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
class RateLimitRules {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {
        this.rulesEntities = new Map();
        this.rules = new Map();
    }
    async loadData(forceDbLoad = false) {
        // Try to load from cache
        const rulesCache = await redis_1.redis.get(RateLimitRules.getCacheKey());
        let rules;
        if (lodash_1.default.isNull(rulesCache) || forceDbLoad) {
            // If no cache load from DB
            rules = await db_1.redb.manyOrNone(`SELECT * FROM rate_limit_rules`);
            await redis_1.redis.set(RateLimitRules.getCacheKey(), JSON.stringify(rules), "EX", 60 * 60 * 24);
        }
        else {
            // Parse the cache data
            rules = JSON.parse(rulesCache);
        }
        const newRulesMetadata = new Map(); // Reset current rules
        const newRules = new Map(); // Reset current rules
        for (const rule of rules) {
            const rateLimitRule = new rate_limit_rule_entity_1.RateLimitRuleEntity(rule);
            newRulesMetadata.set(RateLimitRules.getRuleKey(rateLimitRule.route, rateLimitRule.method, rateLimitRule.tier, rateLimitRule.apiKey), rateLimitRule);
            newRules.set(RateLimitRules.getRuleKey(rateLimitRule.route, rateLimitRule.method, rateLimitRule.tier, rateLimitRule.apiKey), new rate_limiter_flexible_1.RateLimiterRedis({
                storeClient: redis_1.rateLimitRedis,
                points: rateLimitRule.options.points,
                duration: rateLimitRule.options.duration,
                inMemoryBlockOnConsumed: rateLimitRule.options.points,
            }));
        }
        this.rulesEntities = newRulesMetadata;
        this.rules = newRules;
    }
    static getRuleKey(route, method, tier, apiKey) {
        return `${route}:${method}:${lodash_1.default.isNull(tier) ? "" : tier}:${apiKey}`;
    }
    static getDefaultRuleKeyForTier(tier) {
        return RateLimitRules.getRuleKey("/", "", tier, "");
    }
    static getCacheKey() {
        return "rate-limit-rules";
    }
    static async forceDataReload() {
        if (RateLimitRules.instance) {
            await RateLimitRules.instance.loadData(true);
        }
    }
    static async getInstance() {
        if (!this.instance) {
            this.instance = new RateLimitRules();
            await this.instance.loadData();
        }
        return this.instance;
    }
    static async create(route, apiKey, method, tier, options) {
        const query = `INSERT INTO rate_limit_rules (route, api_key, method, tier, options)
                   VALUES ($/route/, $/apiKey/, $/method/, $/tier/, $/options:json/)
                   RETURNING *`;
        const values = {
            route,
            apiKey,
            method,
            tier,
            options,
        };
        const rateLimitRule = await db_1.idb.oneOrNone(query, values);
        const rateLimitRuleEntity = new rate_limit_rule_entity_1.RateLimitRuleEntity(rateLimitRule);
        await RateLimitRules.forceDataReload(); // reload the cache
        await redis_1.redis.publish(channels_1.channels.rateLimitRuleUpdated, `New rate limit rule ${JSON.stringify(rateLimitRuleEntity)}`);
        logger_1.logger.info("rate-limit-rules", `New rate limit rule ${JSON.stringify(rateLimitRuleEntity)} was created`);
        return rateLimitRuleEntity;
    }
    static async update(id, fields) {
        let updateString = "";
        let jsonBuildObject = "";
        const replacementValues = {
            id,
        };
        lodash_1.default.forEach(fields, (param, fieldName) => {
            if (fieldName === "options") {
                lodash_1.default.forEach(fields.options, (value, key) => {
                    if (!lodash_1.default.isUndefined(value)) {
                        jsonBuildObject += `'${key}', $/${key}/,`;
                        replacementValues[key] = value;
                    }
                });
                jsonBuildObject = lodash_1.default.trimEnd(jsonBuildObject, ",");
                if (jsonBuildObject !== "") {
                    updateString += `options = options || jsonb_build_object (${jsonBuildObject}),`;
                }
            }
            else if (!lodash_1.default.isUndefined(param)) {
                updateString += `${lodash_1.default.snakeCase(fieldName)} = $/${fieldName}/,`;
                replacementValues[fieldName] = param;
            }
        });
        updateString = lodash_1.default.trimEnd(updateString, ",");
        const query = `UPDATE rate_limit_rules
                   SET ${updateString}
                   WHERE id = $/id/`;
        await db_1.idb.none(query, replacementValues);
        await redis_1.redis.publish(channels_1.channels.rateLimitRuleUpdated, `Updated rule id ${id}`);
    }
    static async delete(id) {
        const query = `DELETE FROM rate_limit_rules
                   WHERE id = $/id/`;
        const values = {
            id,
        };
        await db_1.idb.none(query, values);
        await RateLimitRules.forceDataReload(); // reload the cache
        await redis_1.redis.publish(channels_1.channels.rateLimitRuleUpdated, `Deleted rule id ${id}`);
    }
    static async getApiKeyRateLimits(key) {
        const apiKey = await api_keys_1.ApiKeyManager.getApiKey(key);
        const tier = (apiKey === null || apiKey === void 0 ? void 0 : apiKey.tier) || 0;
        const query = `SELECT DISTINCT ON (route) *
                   FROM rate_limit_rules
                   WHERE (tier = $/tier/ AND api_key IN ('', $/key/))
                   OR (tier IS NULL AND api_key IN ('', $/key/))
                   OR (api_key = $/key/)
                   ORDER BY route, api_key DESC`;
        const values = {
            tier,
            key,
        };
        const rules = await db_1.redb.manyOrNone(query, values);
        return lodash_1.default.map(rules, (rule) => new rate_limit_rule_entity_1.RateLimitRuleEntity(rule));
    }
    getRule(route, method, tier, apiKey = "") {
        let rule;
        // Check for api key specific rule on the route method
        rule = this.rules.get(RateLimitRules.getRuleKey(route, method, null, apiKey));
        if (rule) {
            rule.keyPrefix = route;
            return rule;
        }
        // Check for api key specific rule on the route
        rule = this.rules.get(RateLimitRules.getRuleKey(route, "", null, apiKey));
        if (rule) {
            rule.keyPrefix = route;
            return rule;
        }
        // Check for route method rule for the given tier
        rule = this.rules.get(RateLimitRules.getRuleKey(route, method, tier, ""));
        if (rule) {
            rule.keyPrefix = route;
            return rule;
        }
        // Check for route method rule for all tiers
        rule = this.rules.get(RateLimitRules.getRuleKey(route, method, null, ""));
        if (rule) {
            rule.keyPrefix = route;
            return rule;
        }
        // Check for route all methods rule
        rule = this.rules.get(RateLimitRules.getRuleKey(route, "", tier, ""));
        if (rule) {
            rule.keyPrefix = route;
            return rule;
        }
        // Check for route all methods rule all tiers
        rule = this.rules.get(RateLimitRules.getRuleKey(route, "", null, ""));
        if (rule) {
            rule.keyPrefix = route;
            return rule;
        }
        rule = this.rules.get(RateLimitRules.getDefaultRuleKeyForTier(tier));
        if (rule) {
            return rule;
        }
        return null;
    }
    getAllRules() {
        return RateLimitRules.instance.rulesEntities;
    }
}
exports.RateLimitRules = RateLimitRules;
//# sourceMappingURL=index.js.map