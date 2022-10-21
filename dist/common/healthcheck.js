"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheck = void 0;
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
class HealthCheck {
    static async check() {
        try {
            await db_1.hdb.query("SELECT 1");
        }
        catch (error) {
            logger_1.logger.error("healthcheck", `Postgres Healthcheck failed: ${error}`);
            return false;
        }
        try {
            await redis_1.redis.ping();
        }
        catch (error) {
            logger_1.logger.error("healthcheck", `Redis Healthcheck failed: ${error}`);
            return false;
        }
        return true;
    }
}
exports.HealthCheck = HealthCheck;
//# sourceMappingURL=healthcheck.js.map