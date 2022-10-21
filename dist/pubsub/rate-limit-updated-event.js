"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitUpdatedEvent = void 0;
const channels_1 = require("@/pubsub/channels");
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const rate_limit_rules_1 = require("@/models/rate-limit-rules");
class RateLimitUpdatedEvent {
    static async handleEvent(message) {
        await rate_limit_rules_1.RateLimitRules.forceDataReload();
        logger_1.logger.info(channels_1.channels.rateLimitRuleUpdated, `Reloaded rate limit rules message=${message} on ${index_1.config.railwayStaticUrl}`);
    }
}
exports.RateLimitUpdatedEvent = RateLimitUpdatedEvent;
//# sourceMappingURL=rate-limit-updated-event.js.map