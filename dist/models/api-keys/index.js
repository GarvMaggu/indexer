"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyManager = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const api_key_entity_1 = require("@/models/api-keys/api-key-entity");
const uuid_by_string_1 = __importDefault(require("uuid-by-string"));
const channels_1 = require("@/pubsub/channels");
const axios_1 = __importDefault(require("axios"));
const network_1 = require("@/config/network");
const index_1 = require("@/config/index");
class ApiKeyManager {
    /**
     * Create a new key, leave the ApiKeyRecord.key empty to generate a new key (uuid) in this function
     *
     * @param values
     */
    async create(values) {
        // Create a new key if none was set
        if (!values.key) {
            values.key = (0, uuid_by_string_1.default)(`${values.key}${values.email}${values.website}`);
        }
        let created;
        // Create the record in the database
        try {
            created = await db_1.idb.oneOrNone("INSERT INTO api_keys (${this:name}) VALUES (${this:csv}) ON CONFLICT DO NOTHING RETURNING 1", values);
        }
        catch (e) {
            logger_1.logger.error("api-key", `Unable to create a new apikeys record: ${e}`);
            return false;
        }
        // Cache the key on redis for faster lookup
        try {
            const redisKey = `apikey:${values.key}`;
            await redis_1.redis.hset(redisKey, new Map(Object.entries(values)));
        }
        catch (e) {
            logger_1.logger.error("api-key", `Unable to set the redis hash: ${e}`);
            // Let's continue here, even if we can't write to redis, we should be able to check the values against the db
        }
        if (created) {
            await ApiKeyManager.notifyApiKeyCreated(values);
        }
        return {
            key: values.key,
        };
    }
    static async deleteCachedApiKey(key) {
        ApiKeyManager.apiKeys.delete(key); // Delete from local memory cache
        await redis_1.redis.del(`api-key:${key}`); // Delete from redis cache
    }
    /**
     * When a user passes an api key, we retrieve the details from redis
     * In case the details are not in redis (new redis, api key somehow disappeared from redis) we try to fetch it from
     * the database. In case we couldn't find the key in the database, the key must be wrong. To avoid us doing the
     * lookup constantly in the database, we set a temporary hash key in redis with one value { empty: true }
     *
     * @param key
     */
    static async getApiKey(key) {
        const cachedApiKey = ApiKeyManager.apiKeys.get(key);
        if (cachedApiKey) {
            return cachedApiKey;
        }
        // Timeout for redis
        const timeout = new Promise((resolve) => {
            setTimeout(resolve, 1000, null);
        });
        const redisKey = `api-key:${key}`;
        try {
            const apiKey = await Promise.race([redis_1.redis.get(redisKey), timeout]);
            if (apiKey) {
                if (apiKey == "empty") {
                    return null;
                }
                else {
                    const apiKeyEntity = new api_key_entity_1.ApiKeyEntity(JSON.parse(apiKey));
                    ApiKeyManager.apiKeys.set(key, apiKeyEntity); // Set in local memory storage
                    return apiKeyEntity;
                }
            }
            else {
                // check if it exists in the database
                const fromDb = await db_1.redb.oneOrNone(`SELECT * FROM api_keys WHERE key = $/key/ AND active = true`, { key });
                if (fromDb) {
                    Promise.race([redis_1.redis.set(redisKey, JSON.stringify(fromDb)), timeout]); // Set in redis (no need to wait)
                    const apiKeyEntity = new api_key_entity_1.ApiKeyEntity(fromDb);
                    ApiKeyManager.apiKeys.set(key, apiKeyEntity); // Set in local memory storage
                    return apiKeyEntity;
                }
                else {
                    const pipeline = redis_1.redis.pipeline();
                    pipeline.set(redisKey, "empty");
                    pipeline.expire(redisKey, 3600 * 24);
                    Promise.race([pipeline.exec(), timeout]); // Set in redis (no need to wait)
                }
            }
        }
        catch (error) {
            logger_1.logger.error("get-api-key", `Failed to get ${key} error: ${error}`);
        }
        return null;
    }
    /**
     * Log usage of the api key in the logger
     *
     * @param request
     */
    static async logUsage(request) {
        const key = request.headers["x-api-key"];
        const log = {
            route: request.route.path,
            method: request.route.method,
        };
        if (request.payload) {
            log.payload = request.payload;
        }
        if (request.params) {
            log.params = request.params;
        }
        if (request.query) {
            log.query = request.query;
        }
        if (request.headers["x-forwarded-for"]) {
            log.remoteAddress = request.headers["x-forwarded-for"];
        }
        if (request.headers["origin"]) {
            log.origin = request.headers["origin"];
        }
        if (request.headers["x-rkui-version"]) {
            log.rkuiVersion = request.headers["x-rkui-version"];
        }
        if (request.headers["x-rkc-version"]) {
            log.rkcVersion = request.headers["x-rkc-version"];
        }
        if (request.info.referrer) {
            log.referrer = request.info.referrer;
        }
        if (request.headers["host"]) {
            log.hostname = request.headers["host"];
        }
        // Add key information if it exists
        if (key) {
            try {
                const apiKey = await ApiKeyManager.getApiKey(key);
                // There is a key, set that key information
                if (apiKey) {
                    log.apiKey = apiKey;
                }
                else {
                    // There is a key, but it's null
                    log.apiKey = {};
                    log.apiKey.app_name = key;
                }
            }
            catch (e) {
                logger_1.logger.info("api-key", e.message);
            }
        }
        else {
            // No key, just log No Key as the app name
            log.apiKey = {};
            log.apiKey.app_name = "No Key";
        }
        logger_1.logger.info("metrics", JSON.stringify(log));
    }
    static async update(key, fields) {
        let updateString = "";
        const replacementValues = {
            key,
        };
        lodash_1.default.forEach(fields, (value, fieldName) => {
            if (!lodash_1.default.isUndefined(value)) {
                updateString += `${lodash_1.default.snakeCase(fieldName)} = $/${fieldName}/,`;
                replacementValues[fieldName] = value;
            }
        });
        updateString = lodash_1.default.trimEnd(updateString, ",");
        const query = `UPDATE api_keys
                   SET ${updateString}
                   WHERE key = $/key/`;
        await db_1.idb.none(query, replacementValues);
        await ApiKeyManager.deleteCachedApiKey(key); // reload the cache
        await redis_1.redis.publish(channels_1.channels.apiKeyUpdated, JSON.stringify({ key }));
    }
    static async notifyApiKeyCreated(values) {
        await axios_1.default
            .post(index_1.config.slackApiKeyWebhookUrl, JSON.stringify({
            text: "API Key created",
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "API Key created",
                    },
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `New API Key created on *${(0, network_1.getNetworkName)()}*`,
                    },
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Key:* ${values.key}`,
                    },
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*AppName:* ${values.app_name}`,
                    },
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Website:* ${values.website}`,
                    },
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Email:* ${values.email}`,
                    },
                },
            ],
        }), {
            headers: {
                "Content-Type": "application/json",
            },
        })
            .catch(() => {
            // Skip on any errors
        });
    }
}
exports.ApiKeyManager = ApiKeyManager;
ApiKeyManager.apiKeys = new Map();
//# sourceMappingURL=index.js.map