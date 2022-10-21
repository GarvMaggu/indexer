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
const Sdk = __importStar(require("@reservoir0x/sdk"));
const bullmq_1 = require("bullmq");
const crypto_1 = require("crypto");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const looksRareCheck = __importStar(require("@/orderbook/orders/looks-rare/check"));
const seaportCheck = __importStar(require("@/orderbook/orders/seaport/check"));
const x2y2Check = __importStar(require("@/orderbook/orders/x2y2/check"));
const zeroExV4Check = __importStar(require("@/orderbook/orders/zeroex-v4/check"));
const QUEUE_NAME = "order-fixes";
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 10000,
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
        const { by, data } = job.data;
        try {
            switch (by) {
                case "id": {
                    // If the order is valid or potentially valid, recheck it's status
                    const result = await db_1.redb.oneOrNone(`
                SELECT
                  orders.kind,
                  orders.raw_data
                FROM orders
                WHERE orders.id = $/id/
                  AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                  AND (orders.approval_status = 'approved' OR orders.approval_status = 'no-approval')
              `, { id: data.id });
                    if (result) {
                        let fillabilityStatus = "fillable";
                        let approvalStatus = "approved";
                        switch (result.kind) {
                            case "looks-rare": {
                                const order = new Sdk.LooksRare.Order(index_1.config.chainId, result.raw_data);
                                try {
                                    await looksRareCheck.offChainCheck(order, {
                                        onChainApprovalRecheck: true,
                                        checkFilledOrCancelled: true,
                                    });
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                }
                                catch (error) {
                                    if (error.message === "cancelled") {
                                        fillabilityStatus = "cancelled";
                                    }
                                    else if (error.message === "filled") {
                                        fillabilityStatus = "filled";
                                    }
                                    else if (error.message === "no-balance") {
                                        fillabilityStatus = "no-balance";
                                    }
                                    else if (error.message === "no-approval") {
                                        approvalStatus = "no-approval";
                                    }
                                    else if (error.message === "no-balance-no-approval") {
                                        fillabilityStatus = "no-balance";
                                        approvalStatus = "no-approval";
                                    }
                                }
                                break;
                            }
                            case "x2y2": {
                                const order = new Sdk.X2Y2.Order(index_1.config.chainId, result.raw_data);
                                try {
                                    await x2y2Check.offChainCheck(order, {
                                        onChainApprovalRecheck: true,
                                        checkFilledOrCancelled: true,
                                    });
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                }
                                catch (error) {
                                    if (error.message === "cancelled") {
                                        fillabilityStatus = "cancelled";
                                    }
                                    else if (error.message === "filled") {
                                        fillabilityStatus = "filled";
                                    }
                                    else if (error.message === "no-balance") {
                                        fillabilityStatus = "no-balance";
                                    }
                                    else if (error.message === "no-approval") {
                                        approvalStatus = "no-approval";
                                    }
                                    else if (error.message === "no-balance-no-approval") {
                                        fillabilityStatus = "no-balance";
                                        approvalStatus = "no-approval";
                                    }
                                }
                                break;
                            }
                            case "zeroex-v4-erc721":
                            case "zeroex-v4-erc1155": {
                                const order = new Sdk.ZeroExV4.Order(index_1.config.chainId, result.raw_data);
                                try {
                                    await zeroExV4Check.offChainCheck(order, {
                                        onChainApprovalRecheck: true,
                                        checkFilledOrCancelled: true,
                                    });
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                }
                                catch (error) {
                                    if (error.message === "cancelled") {
                                        fillabilityStatus = "cancelled";
                                    }
                                    else if (error.message === "filled") {
                                        fillabilityStatus = "filled";
                                    }
                                    else if (error.message === "no-balance") {
                                        fillabilityStatus = "no-balance";
                                    }
                                    else if (error.message === "no-approval") {
                                        approvalStatus = "no-approval";
                                    }
                                    else if (error.message === "no-balance-no-approval") {
                                        fillabilityStatus = "no-balance";
                                        approvalStatus = "no-approval";
                                    }
                                }
                                break;
                            }
                            case "seaport": {
                                const order = new Sdk.Seaport.Order(index_1.config.chainId, result.raw_data);
                                try {
                                    await seaportCheck.offChainCheck(order, {
                                        onChainApprovalRecheck: true,
                                        checkFilledOrCancelled: true,
                                    });
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                }
                                catch (error) {
                                    if (error.message === "cancelled") {
                                        fillabilityStatus = "cancelled";
                                    }
                                    else if (error.message === "filled") {
                                        fillabilityStatus = "filled";
                                    }
                                    else if (error.message === "no-balance") {
                                        fillabilityStatus = "no-balance";
                                    }
                                    else if (error.message === "no-approval") {
                                        approvalStatus = "no-approval";
                                    }
                                    else if (error.message === "no-balance-no-approval") {
                                        fillabilityStatus = "no-balance";
                                        approvalStatus = "no-approval";
                                    }
                                }
                                break;
                            }
                        }
                        const fixResult = await db_1.idb.oneOrNone(`
                  UPDATE "orders" AS "o" SET
                    "fillability_status" = $/fillabilityStatus/,
                    "approval_status" = $/approvalStatus/,
                    "updated_at" = now()
                  WHERE "o"."id" = $/id/
                    AND ("o"."fillability_status" != $/fillabilityStatus/ OR "o"."approval_status" != $/approvalStatus/)
                  RETURNING "o"."id"
                `, {
                            id: data.id,
                            fillabilityStatus,
                            approvalStatus,
                        });
                        if (fixResult) {
                            // Update any wrong caches
                            await orderUpdatesById.addToQueue([
                                {
                                    context: `revalidation-${Date.now()}-${fixResult.id}`,
                                    id: fixResult.id,
                                    trigger: {
                                        kind: "revalidation",
                                    },
                                },
                            ]);
                        }
                    }
                    break;
                }
                case "token": {
                    // Trigger a fix for all valid orders on the token
                    const result = await db_1.redb.manyOrNone(`
                SELECT "o"."id" FROM "orders" "o"
                WHERE "o"."token_set_id" = $/tokenSetId/
                  AND ("o"."fillability_status" = 'fillable' AND "o"."approval_status" = 'approved')
              `, { tokenSetId: `token:${data.token}` });
                    if (result) {
                        await (0, exports.addToQueue)(result.map(({ id }) => ({ by: "id", data: { id } })));
                    }
                    break;
                }
                case "maker": {
                    // Trigger a fix for all of valid orders from the maker
                    // TODO: Use keyset pagination to be able to handle large amounts of orders
                    const result = await db_1.redb.manyOrNone(`
                SELECT "o"."id" FROM "orders" "o"
                WHERE "o"."maker" = $/maker/
                  AND "o"."fillability_status" = 'fillable'
                  AND "o"."approval_status" = 'approved'
              `, { maker: (0, utils_1.toBuffer)(data.maker) });
                    if (result) {
                        await (0, exports.addToQueue)(result.map(({ id }) => ({ by: "id", data: { id } })));
                    }
                    break;
                }
                case "contract": {
                    // Trigger a fix for all valid orders on the contract
                    for (const side of ["sell", "buy"]) {
                        // TODO: Use keyset pagination to be able to handle large amounts of orders
                        const result = await db_1.redb.manyOrNone(`
                  SELECT "o"."id" FROM "orders" "o"
                  WHERE "o"."side" = $/side/ AND "o"."contract" = $/contract/
                    AND ("o"."fillability_status" = 'fillable' AND "o"."approval_status" = 'approved')
                `, 
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        { contract: (0, utils_1.toBuffer)(data.contract), side });
                        if (result) {
                            await (0, exports.addToQueue)(result.map(({ id }) => ({ by: "id", data: { id } })));
                        }
                    }
                    break;
                }
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to handle order fix info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 20 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (orderFixInfos) => {
    await exports.queue.addBulk(orderFixInfos.map((orderFixInfo) => ({
        name: (0, crypto_1.randomUUID)(),
        data: orderFixInfo,
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=queue.js.map