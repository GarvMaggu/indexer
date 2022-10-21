"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingRefreshTokens = void 0;
const lodash_1 = __importDefault(require("lodash"));
const redis_1 = require("@/common/redis");
/**
 * Class that manage redis list of tokens, pending metadata refresh
 */
class PendingRefreshTokens {
    constructor(method) {
        this.key = "pending-refresh-tokens";
        this.key += `:${method}`;
    }
    async add(refreshToken, prioritized = false) {
        if (prioritized) {
            return await redis_1.redis.lpush(this.key, lodash_1.default.map(refreshToken, (token) => JSON.stringify(token)));
        }
        else {
            return await redis_1.redis.rpush(this.key, lodash_1.default.map(refreshToken, (token) => JSON.stringify(token)));
        }
    }
    async get(count = 20) {
        const refreshTokens = await redis_1.redis.lpop(this.key, count);
        if (refreshTokens) {
            return lodash_1.default.map(refreshTokens, (refreshToken) => JSON.parse(refreshToken));
        }
        return [];
    }
}
exports.PendingRefreshTokens = PendingRefreshTokens;
//# sourceMappingURL=index.js.map