"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("@/pubsub/channels");
// Import and subscribe to the following events
require("@/pubsub/sources-updated-event");
const lodash_1 = __importDefault(require("lodash"));
const redis_1 = require("@/common/redis");
const channels_1 = require("@/pubsub/channels");
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const sources_updated_event_1 = require("@/pubsub/sources-updated-event");
const api_key_updated_event_1 = require("@/pubsub/api-key-updated-event");
const rate_limit_updated_event_1 = require("@/pubsub/rate-limit-updated-event");
// Subscribe to all channels defined in the channels enum
redis_1.redisSubscriber.subscribe(lodash_1.default.values(channels_1.channels), (err, count) => {
    if (err) {
        logger_1.logger.error("pubsub", `Failed to subscribe ${err.message}`);
    }
    logger_1.logger.info("pubsub", `${index_1.config.railwayStaticUrl} subscribed to ${count} channels`);
});
redis_1.redisSubscriber.on("message", async (channel, message) => {
    logger_1.logger.info("pubsub", `Received message on channel ${channel}, message = ${message}`);
    switch (channel) {
        case channels_1.channels.sourcesUpdated:
            await sources_updated_event_1.SourcesUpdatedEvent.handleEvent(message);
            break;
        case channels_1.channels.apiKeyUpdated:
            await api_key_updated_event_1.ApiKeyUpdatedEvent.handleEvent(message);
            break;
        case channels_1.channels.rateLimitRuleUpdated:
            await rate_limit_updated_event_1.RateLimitUpdatedEvent.handleEvent(message);
            break;
    }
});
//# sourceMappingURL=index.js.map