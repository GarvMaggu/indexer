"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const lodash_1 = __importDefault(require("lodash"));
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const QUEUE_NAME = "resync-orders-source-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: 10000,
        removeOnFail: 10000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { continuation, maxId } = job.data;
        const limit = 2000;
        const updateValues = {};
        let continuationFilter = "";
        if (continuation != "") {
            continuationFilter = `WHERE id > '${continuation}'`;
            if (maxId != "") {
                continuationFilter += ` AND id < '${maxId}'`;
            }
        }
        const query = `SELECT id, source_id, source_id_int
                     FROM orders
                     ${continuationFilter}
                     ORDER BY id ASC
                     LIMIT ${limit}`;
        const orders = await db_1.redb.manyOrNone(query);
        if (orders) {
            for (const order of orders) {
                if (lodash_1.default.isNull(order.source_id)) {
                    continue;
                }
                const sourceId = (0, utils_1.fromBuffer)(order.source_id);
                let sourceIdInt;
                switch (sourceId) {
                    case "0x5b3256965e7c3cf26e11fcaf296dfc8807c01073": // OpenSea
                        sourceIdInt = 1;
                        break;
                    case "0xfdfda3d504b1431ea0fd70084b1bfa39fa99dcc4": // Forgotten Market
                        sourceIdInt = 2;
                        break;
                    case "0x5924a28caaf1cc016617874a2f0c3710d881f3c1": // LooksRare
                        sourceIdInt = 3;
                        break;
                }
                updateValues[order.id] = sourceIdInt;
            }
            let updateValuesString = "";
            lodash_1.default.forEach(updateValues, (source, id) => {
                updateValuesString += `('${id}', ${source}),`;
            });
            updateValuesString = lodash_1.default.trimEnd(updateValuesString, ",");
            job.data.cursor = null;
            if (lodash_1.default.size(orders) == limit) {
                const lastOrder = lodash_1.default.last(orders);
                logger_1.logger.info(QUEUE_NAME, `Updated ${lodash_1.default.size(updateValues)} orders, lastOrder=${JSON.stringify(lastOrder)}`);
                job.data.cursor = lastOrder.id;
            }
            try {
                const updateQuery = `UPDATE orders
                             SET source_id_int = x.sourceIdColumn, updated_at = now()
                             FROM (VALUES ${updateValuesString}) AS x(idColumn, sourceIdColumn)
                             WHERE x.idColumn = orders.id`;
                await db_1.idb.none(updateQuery);
            }
            catch (error) {
                logger_1.logger.error(QUEUE_NAME, `${error}`);
            }
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 4 });
    worker.on("completed", async (job) => {
        if (job.data.cursor) {
            await (0, exports.addToQueue)(job.data.cursor, job.data.maxId);
        }
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (continuation = "", maxId = "") => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { continuation, maxId });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-resync-orders-source.js.map