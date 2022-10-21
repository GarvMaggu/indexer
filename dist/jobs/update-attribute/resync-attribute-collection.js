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
const QUEUE_NAME = "resync-attribute-collection-queue";
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
        const { continuation } = job.data;
        const limit = 200;
        const updateValues = {};
        const replacementParams = {};
        let continuationFilter = "";
        if (continuation != "") {
            continuationFilter = `WHERE id > ${Number(continuation)}`;
        }
        const query = `SELECT id, key
                     FROM attribute_keys
                     ${continuationFilter}
                     ORDER BY id ASC
                     LIMIT ${limit}`;
        const attributeKeys = await db_1.redb.manyOrNone(query);
        if (attributeKeys) {
            for (const attributeKey of attributeKeys) {
                updateValues[attributeKey.id] = {
                    id: attributeKey.id,
                    key: attributeKey.key,
                };
            }
            let updateValuesString = "";
            lodash_1.default.forEach(attributeKeys, (data) => {
                replacementParams[`${data.id}`] = data.key;
                updateValuesString += `(${data.id}, $/${data.id}/),`;
            });
            updateValuesString = lodash_1.default.trimEnd(updateValuesString, ",");
            job.data.cursor = null;
            if (lodash_1.default.size(attributeKeys) == limit) {
                const lastAttributeKey = lodash_1.default.last(attributeKeys);
                logger_1.logger.info(QUEUE_NAME, `Updated ${lodash_1.default.size(updateValues)} attributes, lastAttributeKey=${JSON.stringify(lastAttributeKey)}`);
                job.data.cursor = lastAttributeKey.id;
            }
            try {
                const updateQuery = `UPDATE attributes
                               SET key = x.keyColumn
                               FROM (VALUES ${updateValuesString}) AS x(idColumn, keyColumn)
                               WHERE x.idColumn = attributes.attribute_key_id`;
                await db_1.idb.none(updateQuery, replacementParams);
            }
            catch (error) {
                logger_1.logger.error(QUEUE_NAME, `${error}`);
            }
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 4 });
    worker.on("completed", async (job) => {
        if (job.data.cursor) {
            await (0, exports.addToQueue)(job.data.cursor);
        }
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (continuation = "") => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { continuation });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=resync-attribute-collection.js.map