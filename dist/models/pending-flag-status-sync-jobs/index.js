"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingFlagStatusSyncJobs = void 0;
const redis_1 = require("@/common/redis");
/**
 * Class that manage redis list of tokens, pending flag status sync
 */
class PendingFlagStatusSyncJobs {
    constructor() {
        this.key = "pending-flag-status-sync-jobs";
    }
    async add(jobs, prioritized = false) {
        if (prioritized) {
            return await redis_1.redis.zadd(this.key, "NX", ...jobs.map((job) => ["-inf", JSON.stringify(job)]).flat());
        }
        else {
            return await redis_1.redis.zadd(this.key, "NX", ...jobs.map((job) => [Date.now(), JSON.stringify(job)]).flat());
        }
    }
    async next() {
        const result = await redis_1.redis.zpopmin(this.key);
        return result.length ? JSON.parse(result[0]) : null;
    }
}
exports.PendingFlagStatusSyncJobs = PendingFlagStatusSyncJobs;
//# sourceMappingURL=index.js.map