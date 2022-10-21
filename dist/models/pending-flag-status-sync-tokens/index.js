"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingFlagStatusSyncTokens = void 0;
const lodash_1 = __importDefault(require("lodash"));
const redis_1 = require("@/common/redis");
/**
 * Class that manage redis list of tokens, pending flag status sync
 */
class PendingFlagStatusSyncTokens {
    constructor(collectionId) {
        this.key = "pending-flag-status-sync-tokens";
        this.key += `:${collectionId}`;
    }
    async add(tokens, prioritized = false) {
        if (prioritized) {
            return await redis_1.redis.lpush(this.key, lodash_1.default.map(tokens, (token) => JSON.stringify(token)));
        }
        else {
            return await redis_1.redis.rpush(this.key, lodash_1.default.map(tokens, (token) => JSON.stringify(token)));
        }
    }
    async get(count = 1) {
        const tokens = await redis_1.redis.lpop(this.key, count);
        if (tokens) {
            return lodash_1.default.map(tokens, (token) => JSON.parse(token));
        }
        return [];
    }
    async count() {
        return await redis_1.redis.llen(this.key);
    }
}
exports.PendingFlagStatusSyncTokens = PendingFlagStatusSyncTokens;
//# sourceMappingURL=index.js.map