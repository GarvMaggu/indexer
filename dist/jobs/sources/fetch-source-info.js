"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const logger_1 = require("@/common/logger");
const axios_1 = __importDefault(require("axios"));
const lodash_1 = __importDefault(require("lodash"));
const node_html_parser_1 = require("node-html-parser");
const sources_1 = require("@/models/sources");
const QUEUE_NAME = "fetch-source-info-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 100,
        removeOnFail: 1000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { sourceDomain } = job.data;
        let url = sourceDomain;
        let iconUrl;
        if (!lodash_1.default.startsWith(url, "http")) {
            url = `https://${url}`;
        }
        // Get the domain HTML
        const response = await axios_1.default.get(url);
        const html = (0, node_html_parser_1.parse)(response.data);
        // First get the custom reservoir title tag
        const reservoirTitle = html.querySelector("meta[property='reservoir:title']");
        let titleText = sourceDomain; // Default name for source is the domain
        if (reservoirTitle) {
            titleText = reservoirTitle.getAttribute("content");
        }
        // First get the custom reservoir icon tag
        const reservoirIcon = html.querySelector("meta[property='reservoir:icon']");
        if (reservoirIcon) {
            iconUrl = reservoirIcon.getAttribute("content");
        }
        else {
            // Get the domain default icon
            const icon = html.querySelector("link[rel*='icon']");
            if (icon) {
                iconUrl = icon.getAttribute("href");
            }
        }
        // If this a relative url
        if (iconUrl && lodash_1.default.startsWith(iconUrl, "//")) {
            iconUrl = `https://${lodash_1.default.trimStart(iconUrl, "//")}`;
        }
        else if (iconUrl && lodash_1.default.startsWith(iconUrl, "/")) {
            iconUrl = `${url}${iconUrl}`;
        }
        else if (iconUrl && !lodash_1.default.startsWith(iconUrl, "http")) {
            iconUrl = `${url}/${iconUrl}`;
        }
        const tokenUrlMainnet = getTokenUrl(html, url, "mainnet");
        const tokenUrlRinkeby = getTokenUrl(html, url, "rinkeby");
        // Update the source data
        const sources = await sources_1.Sources.getInstance();
        await sources.update(sourceDomain, {
            title: titleText,
            icon: iconUrl,
            tokenUrlMainnet,
            tokenUrlRinkeby,
        });
    }, {
        connection: redis_1.redis.duplicate(),
        concurrency: 3,
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
function getTokenUrl(html, domain, network) {
    let tokenUrl;
    // Get the custom reservoir token URL tag for mainnet
    const reservoirTokenUrl = html.querySelector(`meta[property='reservoir:token-url-${network}']`);
    if (reservoirTokenUrl) {
        tokenUrl = reservoirTokenUrl.getAttribute("content");
        // If this a relative url
        if (tokenUrl && lodash_1.default.startsWith(tokenUrl, "/")) {
            tokenUrl = `${domain}${tokenUrl}`;
        }
    }
    return tokenUrl;
}
const addToQueue = async (sourceDomain, delay = 0) => {
    const jobId = `${sourceDomain}`;
    await exports.queue.add(jobId, { sourceDomain }, { delay });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=fetch-source-info.js.map