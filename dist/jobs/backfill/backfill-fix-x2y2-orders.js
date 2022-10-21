"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const QUEUE_NAME = "fix-x2y2-orders-backfill";
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
        const { maker, tokenSetId } = job.data;
        try {
            const results = await db_1.redb.manyOrNone(`
            SELECT
              orders.maker,
              orders.token_set_id,
              count(*)
            FROM orders
            WHERE orders.kind = 'x2y2'
              AND orders.side = 'sell'
              AND (orders.maker, orders.token_set_id) > ($/maker/, $/tokenSetId/)
            GROUP BY orders.maker, orders.token_set_id
            ORDER BY orders.maker, orders.token_set_id
            LIMIT 100
          `, {
                maker: (0, utils_1.toBuffer)(maker),
                tokenSetId,
            });
            for (const { maker, token_set_id, count } of results) {
                if (Number(count) > 1) {
                    const result = await db_1.redb.manyOrNone(`
                WITH x AS (
                  SELECT orders.id FROM orders
                  WHERE orders.kind = 'x2y2'
                    AND orders.side = 'sell'
                    AND orders.maker = $/maker/
                    AND orders.token_set_id = $/tokenSetId/
                  ORDER BY orders.created_at DESC NULLS LAST
                  OFFSET 1
                )
                UPDATE orders SET
                  fillability_status = 'cancelled'
                FROM x
                WHERE orders.id = x.id
                  AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                RETURNING orders.id
              `, {
                        maker,
                        tokenSetId: token_set_id,
                    });
                    await orderUpdatesById.addToQueue(result.map(({ id }) => ({
                        context: `x2y2-order-fix-${id}`,
                        id,
                        trigger: { kind: "reprice" },
                    })));
                }
            }
            if (results.length) {
                const lastResult = results[results.length - 1];
                await (0, exports.addToQueue)([
                    {
                        maker: (0, utils_1.fromBuffer)(lastResult.maker),
                        tokenSetId: lastResult.token_set_id,
                    },
                ]);
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to handle fix X2Y2 info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate() });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
    // !!! DISABLED
    // redlock
    //   .acquire([`${QUEUE_NAME}-lock`], 60 * 60 * 24 * 30 * 1000)
    //   .then(async () => {
    //     await addToQueue([{ maker: AddressZero, tokenSetId: "" }]);
    //   })
    //   .catch(() => {
    //     // Skip on any errors
    //   });
}
const addToQueue = async (infos) => {
    await exports.queue.addBulk(infos.map((info) => ({
        name: `${info.maker}-${info.tokenSetId}`,
        data: info,
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=backfill-fix-x2y2-orders.js.map