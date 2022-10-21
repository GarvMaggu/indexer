"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const QUEUE_NAME = "backfill-acquired-at-queue";
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
    const worker = new bullmq_1.Worker(QUEUE_NAME, async () => {
        const limit = 10;
        try {
            const query = `
                    WITH x AS (
                        SELECT
                          nft_balances.contract,
                          nft_balances.token_id,
                          nft_balances.owner,
                          to_timestamp(y.timestamp) AS acquired_at
                        FROM nft_balances
                        JOIN LATERAL(
                            SELECT nft_transfer_events."timestamp"
                            FROM nft_transfer_events
                            WHERE nft_transfer_events.address = nft_balances.contract
                            AND nft_transfer_events.token_id = nft_balances.token_id
                            AND nft_transfer_events.to = nft_balances.owner
                            ORDER BY nft_transfer_events.timestamp DESC
                            LIMIT 1
                        ) y ON TRUE
                        WHERE nft_balances.acquired_at IS NULL AND nft_balances.amount > 0
                        LIMIT ${limit}
                    )
                    UPDATE nft_balances AS nb
                    SET acquired_at = x.acquired_at::timestamptz
                    FROM x
                    WHERE nb.contract = x.contract::bytea
                    AND nb.token_id = x.token_id::numeric
                    AND nb.owner = x.owner::bytea;`;
            const { rowCount } = await db_1.idb.result(query);
            logger_1.logger.info(QUEUE_NAME, `Updated ${rowCount} records`);
            if (rowCount > 0) {
                logger_1.logger.info(QUEUE_NAME, `Triggering next job.`);
                await (0, exports.addToQueue)();
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `${error}`);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 1 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock-v2`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue();
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async () => {
    await exports.queue.add((0, crypto_1.randomUUID)(), {}, { delay: 500 });
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-acquired-at-queue.js.map