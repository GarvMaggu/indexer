"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyUpdatedEvent = void 0;
const channels_1 = require("@/pubsub/channels");
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const api_keys_1 = require("@/models/api-keys");
class ApiKeyUpdatedEvent {
    static async handleEvent(message) {
        const parsedMessage = JSON.parse(message);
        await api_keys_1.ApiKeyManager.deleteCachedApiKey(parsedMessage.key);
        logger_1.logger.info(channels_1.channels.apiKeyUpdated, `Reloaded key=${parsedMessage.key} on ${index_1.config.railwayStaticUrl}`);
    }
}
exports.ApiKeyUpdatedEvent = ApiKeyUpdatedEvent;
//# sourceMappingURL=api-key-updated-event.js.map