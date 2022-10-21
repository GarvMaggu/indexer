"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourcesUpdatedEvent = void 0;
const channels_1 = require("@/pubsub/channels");
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const sources_1 = require("@/models/sources");
class SourcesUpdatedEvent {
    static async handleEvent(message) {
        await sources_1.Sources.forceDataReload();
        logger_1.logger.info(channels_1.channels.sourcesUpdated, `Reloaded sources message=${message} on ${index_1.config.railwayStaticUrl}`);
    }
}
exports.SourcesUpdatedEvent = SourcesUpdatedEvent;
//# sourceMappingURL=sources-updated-event.js.map