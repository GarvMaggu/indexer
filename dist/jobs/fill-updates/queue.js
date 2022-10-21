"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const QUEUE_NAME = "fill-updates";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        removeOnComplete: 10000,
        removeOnFail: 10000,
        timeout: 60000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { orderId, orderSide, contract, tokenId, amount, price, timestamp } = job.data;
        try {
            logger_1.logger.info(QUEUE_NAME, `Updating last sale info: ${JSON.stringify(job.data)}`);
            if (orderId) {
                const result = await db_1.idb.oneOrNone(`
              SELECT
                orders.token_set_id
              FROM orders
              WHERE orders.id = $/orderId/
            `, { orderId });
                // If we can detect that the order was on a complex token set
                // (eg. not single token), then update the last buy caches of
                // that particular token set.
                if (result && result.token_set_id) {
                    const components = result.token_set_id.split(":");
                    if (components[0] !== "token") {
                        await db_1.idb.none(`
                  UPDATE token_sets SET
                    last_buy_timestamp = $/timestamp/,
                    last_buy_value = $/price/
                  WHERE id = $/tokenSetId/
                    AND last_buy_timestamp < $/timestamp/
                `, {
                            tokenSetId: result.token_set_id,
                            timestamp,
                            price,
                        });
                    }
                }
            }
            await db_1.idb.none(`
            UPDATE tokens SET
              last_${orderSide}_timestamp = $/timestamp/,
              last_${orderSide}_value = $/price/,
              updated_at = now()
            WHERE contract = $/contract/
              AND token_id = $/tokenId/
              AND coalesce(last_${orderSide}_timestamp, 0) < $/timestamp/
          `, {
                contract: (0, utils_1.toBuffer)(contract),
                tokenId,
                price: (0, utils_1.bn)(price).div(amount).toString(),
                timestamp,
            });
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to handle fill info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 5 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (fillInfos) => {
    await exports.queue.addBulk(fillInfos.map((fillInfo) => ({
        name: `${fillInfo.orderId}`,
        data: fillInfo,
        opts: {
            // We should make sure not to perform any expensive work more
            // than once. As such, we keep the last performed jobs in the
            // queue and give all jobs a deterministic id so that we skip
            // handling jobs that already got executed.
            jobId: fillInfo.context,
        },
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=queue.js.map