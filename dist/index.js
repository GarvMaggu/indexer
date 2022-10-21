"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
require("@/common/tracer");
require("@/jobs/index");
require("@/pubsub/index");
const index_1 = require("@/api/index");
const index_2 = require("@/config/index");
const logger_1 = require("@/common/logger");
const network_1 = require("@/config/network");
const sources_1 = require("@/models/sources");
process.on("unhandledRejection", (error) => {
    logger_1.logger.error("process", `Unhandled rejection: ${error}`);
    // For now, just skip any unhandled errors
    // process.exit(1);
});
const setup = async () => {
    if (index_2.config.doBackgroundWork) {
        await sources_1.Sources.syncSources();
        const networkSettings = (0, network_1.getNetworkSettings)();
        if (networkSettings.onStartup) {
            await networkSettings.onStartup();
        }
    }
    await sources_1.Sources.getInstance();
    await sources_1.Sources.forceDataReload();
};
setup().then(() => (0, index_1.start)());
//# sourceMappingURL=index.js.map