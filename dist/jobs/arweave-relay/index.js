"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPendingOrdersZeroExV4 = exports.addPendingOrdersUniverse = exports.addPendingOrdersLooksRare = exports.addPendingOrdersSeaport = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const network_1 = require("@/config/network");
const PENDING_DATA_KEY = "pending-arweave-data";
// TODO: Add support for relaying token sets
const addPendingOrdersSeaport = async (data) => {
    if (index_1.config.arweaveRelayerKey && data.length) {
        await redis_1.redis.rpush(PENDING_DATA_KEY, ...data.map(({ order, schemaHash }) => JSON.stringify({
            kind: "seaport",
            data: {
                ...order.params,
                schemaHash,
            },
        })));
    }
};
exports.addPendingOrdersSeaport = addPendingOrdersSeaport;
const addPendingOrdersLooksRare = async (data) => {
    if (index_1.config.arweaveRelayerKey && data.length) {
        await redis_1.redis.rpush(PENDING_DATA_KEY, ...data.map(({ order, schemaHash }) => JSON.stringify({
            kind: "looks-rare",
            data: {
                ...order.params,
                schemaHash,
            },
        })));
    }
};
exports.addPendingOrdersLooksRare = addPendingOrdersLooksRare;
const addPendingOrdersUniverse = async (data) => {
    if (index_1.config.arweaveRelayerKey && data.length) {
        await redis_1.redis.rpush(PENDING_DATA_KEY, ...data.map(({ order, schemaHash }) => JSON.stringify({
            kind: "universe",
            data: {
                ...order.params,
                schemaHash,
            },
        })));
    }
};
exports.addPendingOrdersUniverse = addPendingOrdersUniverse;
const addPendingOrdersZeroExV4 = async (data) => {
    if (index_1.config.arweaveRelayerKey && data.length) {
        await redis_1.redis.rpush(PENDING_DATA_KEY, ...data.map(({ order, schemaHash }) => JSON.stringify({
            kind: "zeroex-v4",
            data: {
                ...order.params,
                schemaHash,
            },
        })));
    }
};
exports.addPendingOrdersZeroExV4 = addPendingOrdersZeroExV4;
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork && index_1.config.arweaveRelayerKey) {
    // Optimize as much as possible AR usage efficiency
    const relayInterval = index_1.config.chainId === 1 ? 3 : 24 * 60;
    node_cron_1.default.schedule(`*/${relayInterval} * * * *`, async () => await redis_1.redlock
        .acquire(["arweave-relay-lock"], (60 * relayInterval - 5) * 1000)
        .then(async () => {
        logger_1.logger.info("arweave-relay", "Relaying pending data");
        try {
            let batch = [];
            const batchSize = 1000;
            const iterations = 5;
            for (let i = 0; i < iterations; i++) {
                batch = [
                    ...batch,
                    ...(await redis_1.redis.lrange(PENDING_DATA_KEY, i * batchSize, (i + 1) * batchSize)),
                ];
            }
            if (batch.length) {
                const wallet = JSON.parse(index_1.config.arweaveRelayerKey);
                const transaction = await provider_1.arweaveGateway.createTransaction({
                    data: JSON.stringify(batch.map((b) => JSON.parse(b))),
                }, wallet);
                transaction.addTag("Content-Type", "application/json");
                transaction.addTag("App-Name", `Reservoir Protocol`);
                transaction.addTag("App-Version", "0.0.1");
                transaction.addTag("Network", (0, network_1.getNetworkName)());
                await provider_1.arweaveGateway.transactions.sign(transaction, wallet).then(async () => {
                    const uploader = await provider_1.arweaveGateway.transactions.getUploader(transaction);
                    while (!uploader.isComplete) {
                        await uploader.uploadChunk();
                    }
                });
                logger_1.logger.info("arweave-relay", `${batch.length} pending data entries relayed via transaction ${transaction.id}`);
                await redis_1.redis.ltrim(PENDING_DATA_KEY, batchSize * iterations, -1);
            }
            else {
                logger_1.logger.info("arweave-relay", "No pending data to relay");
            }
        }
        catch (error) {
            logger_1.logger.error("arweave-relay", `Failed to relay pending data: ${error}`);
        }
    }));
}
//# sourceMappingURL=index.js.map