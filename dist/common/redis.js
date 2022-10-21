"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLockExpiration = exports.releaseLock = exports.extendLock = exports.acquireLock = exports.redlock = exports.rateLimitRedis = exports.redisSubscriber = exports.redis = void 0;
const crypto_1 = require("crypto");
const ioredis_1 = __importDefault(require("ioredis"));
const redlock_1 = __importDefault(require("redlock"));
const index_1 = require("@/config/index");
// TODO: Research using a connection pool rather than
// creating a new connection every time, as we do now.
exports.redis = new ioredis_1.default(index_1.config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});
exports.redisSubscriber = new ioredis_1.default(index_1.config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});
exports.rateLimitRedis = new ioredis_1.default(index_1.config.rateLimitRedisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    commandTimeout: 1000,
});
// https://redis.io/topics/distlock
exports.redlock = new redlock_1.default([exports.redis.duplicate()], { retryCount: 0 });
const acquireLock = async (name, expirationInSeconds = 0) => {
    const id = (0, crypto_1.randomUUID)();
    let acquired;
    if (expirationInSeconds) {
        acquired = await exports.redis.set(name, id, "EX", expirationInSeconds, "NX");
    }
    else {
        acquired = await exports.redis.set(name, id, "NX");
    }
    return acquired === "OK";
};
exports.acquireLock = acquireLock;
const extendLock = async (name, expirationInSeconds) => {
    const id = (0, crypto_1.randomUUID)();
    const extended = await exports.redis.set(name, id, "EX", expirationInSeconds, "XX");
    return extended === "OK";
};
exports.extendLock = extendLock;
const releaseLock = async (name) => {
    await exports.redis.del(name);
};
exports.releaseLock = releaseLock;
const getLockExpiration = async (name) => {
    return await exports.redis.ttl(name);
};
exports.getLockExpiration = getLockExpiration;
//# sourceMappingURL=redis.js.map