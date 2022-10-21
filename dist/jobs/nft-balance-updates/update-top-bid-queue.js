"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const QUEUE_NAME = "nft-balance-updates-update-top-bid-queue";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        backoff: {
            type: "exponential",
            delay: 20000,
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
        const { contract, tokenId } = job.data;
        try {
            await db_1.idb.none(`
                WITH x AS (
                    SELECT 
                        nft_balances.contract,
                        nft_balances.token_id,
                        nft_balances.owner,
                        y.id as top_buy_id,
                        y.value as top_buy_value,
                        y.maker as top_buy_maker
                    FROM nft_balances
                    LEFT JOIN LATERAL(
                        SELECT
                            o.id,
                            o.value,
                            o.maker
                        FROM orders o 
                        JOIN token_sets_tokens tst
                        ON o.token_set_id = tst.token_set_id
                        WHERE tst.contract = nft_balances.contract
                        AND tst.token_id = nft_balances.token_id
                        AND o.side = 'buy'
                        AND o.fillability_status = 'fillable'
                        AND o.approval_status = 'approved'
                        AND nft_balances.amount > 0
                        AND nft_balances.owner != o.maker
                        ORDER BY o.value DESC
                        LIMIT 1
                    ) y ON TRUE
                    WHERE nft_balances.contract = $/contract/
                    AND nft_balances.token_id = $/tokenId/
                )
                UPDATE nft_balances AS nb
                SET top_buy_id = x.top_buy_id,
                    top_buy_value = x.top_buy_value,
                    top_buy_maker = x.top_buy_maker
                FROM x
                WHERE nb.contract = x.contract
                AND nb.token_id = x.token_id
                AND nb.owner = x.owner
                AND nb.top_buy_id IS DISTINCT FROM x.top_buy_id
          `, {
                contract: (0, utils_1.toBuffer)(contract),
                tokenId,
            });
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to process nft balance top bid info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 10 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (infos) => {
    await exports.queue.addBulk(infos.map((info) => ({
        name: `${info.contract}-${info.tokenId}`,
        data: info,
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=update-top-bid-queue.js.map