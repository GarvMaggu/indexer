"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderbookApiRateLimiter = void 0;
const redis_1 = require("@/common/redis");
class OrderbookApiRateLimiter {
    constructor(orderbook, orderbookApiKey, limit, interval) {
        this.key = "orderbook-api-rate-limiter";
        this.key += `:${orderbook}:${orderbookApiKey}`;
        this.limit = limit;
        this.interval = interval;
    }
    async reachedLimit() {
        // Always increment count
        const current = await redis_1.redis.incr(this.key);
        if (current == 1) {
            await redis_1.redis.pexpire(this.key, this.interval);
        }
        return current > this.limit;
    }
    async getExpiration() {
        return Math.max(await redis_1.redis.pttl(this.key), 0);
    }
    async setExpiration(ttl) {
        return await redis_1.redis.pexpire(this.key, ttl);
    }
}
exports.OrderbookApiRateLimiter = OrderbookApiRateLimiter;
//# sourceMappingURL=api-rate-limiter.js.map