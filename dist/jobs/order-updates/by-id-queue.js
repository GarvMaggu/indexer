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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const lodash_1 = __importDefault(require("lodash"));
const constants_1 = require("@ethersproject/constants");
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const collectionUpdatesFloorAsk = __importStar(require("@/jobs/collection-updates/floor-queue"));
const handleNewSellOrder = __importStar(require("@/jobs/update-attribute/handle-new-sell-order"));
const handleNewBuyOrder = __importStar(require("@/jobs/update-attribute/handle-new-buy-order"));
const updateNftBalanceFloorAskPriceQueue = __importStar(require("@/jobs/nft-balance-updates/update-floor-ask-price-queue"));
const processActivityEvent = __importStar(require("@/jobs/activities/process-activity-event"));
const collectionUpdatesTopBid = __importStar(require("@/jobs/collection-updates/top-bid-queue"));
const QUEUE_NAME = "order-updates-by-id";
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
        const { id, trigger } = job.data;
        let { side, tokenSetId } = job.data;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let order;
            if (id) {
                // Fetch the order's associated data
                order = await db_1.idb.oneOrNone(`
              SELECT
                orders.id,
                orders.side,
                orders.token_set_id AS "tokenSetId",
                orders.source_id_int AS "sourceIdInt",
                orders.valid_between AS "validBetween",
                COALESCE(orders.quantity_remaining, 1) AS "quantityRemaining",
                orders.nonce,
                orders.maker,
                orders.price,
                orders.value,
                orders.fillability_status AS "fillabilityStatus",
                orders.approval_status AS "approvalStatus",
                token_sets_tokens.contract,
                token_sets_tokens.token_id AS "tokenId"
              FROM orders
              JOIN token_sets_tokens
                ON orders.token_set_id = token_sets_tokens.token_set_id
              WHERE orders.id = $/id/
              LIMIT 1
            `, { id });
                side = order === null || order === void 0 ? void 0 : order.side;
                tokenSetId = order === null || order === void 0 ? void 0 : order.tokenSetId;
            }
            if (side && tokenSetId) {
                // If the order is a complex 'buy' order, then recompute the top bid cache on the token set
                if (side === "buy" && !tokenSetId.startsWith("token")) {
                    const buyOrderResult = await db_1.idb.manyOrNone(`
                WITH x AS (
                  SELECT
                    token_sets.id AS token_set_id,
                    y.*
                  FROM token_sets
                  LEFT JOIN LATERAL (
                    SELECT
                      orders.id AS order_id,
                      orders.value,
                      orders.maker
                    FROM orders
                    WHERE orders.token_set_id = token_sets.id
                      AND orders.side = 'buy'
                      AND orders.fillability_status = 'fillable'
                      AND orders.approval_status = 'approved'
                      AND (orders.taker = '\\x0000000000000000000000000000000000000000' OR orders.taker IS NULL)
                    ORDER BY orders.value DESC
                    LIMIT 1
                  ) y ON TRUE
                  WHERE token_sets.id = $/tokenSetId/
                )
                UPDATE token_sets SET
                  top_buy_id = x.order_id,
                  top_buy_value = x.value,
                  top_buy_maker = x.maker,
                  attribute_id = token_sets.attribute_id,
                  collection_id = token_sets.collection_id
                FROM x
                WHERE token_sets.id = x.token_set_id
                  AND token_sets.top_buy_id IS DISTINCT FROM x.order_id
                RETURNING
                  collection_id AS "collectionId",
                  attribute_id AS "attributeId",
                  top_buy_value AS "topBuyValue"
              `, { tokenSetId });
                    for (const result of buyOrderResult) {
                        if (!lodash_1.default.isNull(result.attributeId)) {
                            await handleNewBuyOrder.addToQueue(result);
                        }
                        if (!lodash_1.default.isNull(result.collectionId)) {
                            await collectionUpdatesTopBid.addToQueue([
                                {
                                    collectionId: result.collectionId,
                                    kind: trigger.kind,
                                    txHash: trigger.txHash || null,
                                    txTimestamp: trigger.txTimestamp || null,
                                },
                            ]);
                        }
                    }
                }
                if (side === "sell") {
                    // Atomically update the cache and trigger an api event if needed
                    const sellOrderResult = await db_1.idb.oneOrNone(`
                WITH z AS (
                  SELECT
                    x.contract,
                    x.token_id,
                    y.order_id,
                    y.value,
                    y.currency,
                    y.currency_value,
                    y.maker,
                    y.valid_between,
                    y.nonce,
                    y.source_id_int,
                    y.is_reservoir
                  FROM (
                    SELECT
                      token_sets_tokens.contract,
                      token_sets_tokens.token_id
                    FROM token_sets_tokens
                    WHERE token_sets_tokens.token_set_id = $/tokenSetId/
                  ) x LEFT JOIN LATERAL (
                    SELECT
                      orders.id AS order_id,
                      orders.value,
                      orders.currency,
                      orders.currency_value,
                      orders.maker,
                      orders.valid_between,
                      orders.source_id_int,
                      orders.nonce,
                      orders.is_reservoir
                    FROM orders
                    JOIN token_sets_tokens
                      ON orders.token_set_id = token_sets_tokens.token_set_id
                    WHERE token_sets_tokens.contract = x.contract
                      AND token_sets_tokens.token_id = x.token_id
                      AND orders.side = 'sell'
                      AND orders.fillability_status = 'fillable'
                      AND orders.approval_status = 'approved'
                      AND (orders.taker = '\\x0000000000000000000000000000000000000000' OR orders.taker IS NULL)
                    ORDER BY orders.value, orders.fee_bps
                    LIMIT 1
                  ) y ON TRUE
                ),
                w AS (
                  UPDATE tokens SET
                    floor_sell_id = z.order_id,
                    floor_sell_value = z.value,
                    floor_sell_currency = z.currency,
                    floor_sell_currency_value = z.currency_value,
                    floor_sell_maker = z.maker,
                    floor_sell_valid_from = least(
                      2147483647::NUMERIC,
                      date_part('epoch', lower(z.valid_between))
                    )::INT,
                    floor_sell_valid_to = least(
                      2147483647::NUMERIC,
                      coalesce(
                        nullif(date_part('epoch', upper(z.valid_between)), 'Infinity'),
                        0
                      )
                    )::INT,
                    floor_sell_source_id_int = z.source_id_int,
                    floor_sell_is_reservoir = z.is_reservoir,
                    updated_at = now()
                  FROM z
                  WHERE tokens.contract = z.contract
                    AND tokens.token_id = z.token_id
                    AND (
                      tokens.floor_sell_id IS DISTINCT FROM z.order_id
                      OR tokens.floor_sell_maker IS DISTINCT FROM z.maker
                      OR tokens.floor_sell_value IS DISTINCT FROM z.value
                    )
                  RETURNING
                    z.contract,
                    z.token_id,
                    z.order_id AS new_floor_sell_id,
                    z.maker AS new_floor_sell_maker,
                    z.value AS new_floor_sell_value,
                    z.valid_between AS new_floor_sell_valid_between,
                    z.nonce AS new_floor_sell_nonce,
                    z.source_id_int AS new_floor_sell_source_id_int,
                    (
                      SELECT tokens.floor_sell_value FROM tokens
                      WHERE tokens.contract = z.contract
                        AND tokens.token_id = z.token_id
                    ) AS old_floor_sell_value
                )
                INSERT INTO token_floor_sell_events(
                  kind,
                  contract,
                  token_id,
                  order_id,
                  maker,
                  price,
                  source_id_int,
                  valid_between,
                  nonce,
                  previous_price,
                  tx_hash,
                  tx_timestamp
                )
                SELECT
                  $/kind/ AS kind,
                  w.contract,
                  w.token_id,
                  w.new_floor_sell_id AS order_id,
                  w.new_floor_sell_maker AS maker,
                  w.new_floor_sell_value AS price,
                  w.new_floor_sell_source_id_int AS source_id_int,
                  w.new_floor_sell_valid_between AS valid_between,
                  w.new_floor_sell_nonce AS nonce,
                  w.old_floor_sell_value AS previous_price,
                  $/txHash/ AS tx_hash,
                  $/txTimestamp/ AS tx_timestamp
                FROM w
                RETURNING
                  kind,
                  contract,
                  token_id AS "tokenId",
                  price,
                  previous_price AS "previousPrice",
                  tx_hash AS "txHash",
                  tx_timestamp AS "txTimestamp"
              `, {
                        tokenSetId,
                        kind: trigger.kind,
                        txHash: trigger.txHash ? (0, utils_1.toBuffer)(trigger.txHash) : null,
                        txTimestamp: trigger.txTimestamp || null,
                    });
                    if (sellOrderResult) {
                        // Update attributes floor
                        sellOrderResult.contract = (0, utils_1.fromBuffer)(sellOrderResult.contract);
                        await handleNewSellOrder.addToQueue(sellOrderResult);
                        // Update collection floor
                        sellOrderResult.txHash = sellOrderResult.txHash
                            ? (0, utils_1.fromBuffer)(sellOrderResult.txHash)
                            : null;
                        await collectionUpdatesFloorAsk.addToQueue([sellOrderResult]);
                    }
                }
                if (order) {
                    if (order.side === "sell") {
                        // Insert a corresponding order event
                        await db_1.idb.none(`
                  INSERT INTO order_events (
                    kind,
                    status,
                    contract,
                    token_id,
                    order_id,
                    order_source_id_int,
                    order_valid_between,
                    order_quantity_remaining,
                    order_nonce,
                    maker,
                    price,
                    tx_hash,
                    tx_timestamp
                  )
                  VALUES (
                    $/kind/,
                    (
                      CASE
                        WHEN $/fillabilityStatus/ = 'filled' THEN 'filled'
                        WHEN $/fillabilityStatus/ = 'cancelled' THEN 'cancelled'
                        WHEN $/fillabilityStatus/ = 'expired' THEN 'expired'
                        WHEN $/fillabilityStatus/ = 'no-balance' THEN 'inactive'
                        WHEN $/approvalStatus/ = 'no-approval' THEN 'inactive'
                        ELSE 'active'
                      END
                    )::order_event_status_t,
                    $/contract/,
                    $/tokenId/,
                    $/id/,
                    $/sourceIdInt/,
                    $/validBetween/,
                    $/quantityRemaining/,
                    $/nonce/,
                    $/maker/,
                    $/value/,
                    $/txHash/,
                    $/txTimestamp/
                  )
                `, {
                            fillabilityStatus: order.fillabilityStatus,
                            approvalStatus: order.approvalStatus,
                            contract: order.contract,
                            tokenId: order.tokenId,
                            id: order.id,
                            sourceIdInt: order.sourceIdInt,
                            validBetween: order.validBetween,
                            quantityRemaining: order.quantityRemaining,
                            nonce: order.nonce,
                            maker: order.maker,
                            value: order.value,
                            kind: trigger.kind,
                            txHash: trigger.txHash ? (0, utils_1.toBuffer)(trigger.txHash) : null,
                            txTimestamp: trigger.txTimestamp || null,
                        });
                        const updateFloorAskPriceInfo = {
                            contract: (0, utils_1.fromBuffer)(order.contract),
                            tokenId: order.tokenId,
                            owner: (0, utils_1.fromBuffer)(order.maker),
                        };
                        await updateNftBalanceFloorAskPriceQueue.addToQueue([updateFloorAskPriceInfo]);
                    }
                    else if (order.side === "buy") {
                        // Insert a corresponding bid event
                        await db_1.idb.none(`
                  INSERT INTO bid_events (
                    kind,
                    status,
                    contract,
                    token_set_id,
                    order_id,
                    order_source_id_int,
                    order_valid_between,
                    order_quantity_remaining,
                    order_nonce,
                    maker,
                    price,
                    value,
                    tx_hash,
                    tx_timestamp
                  )
                  VALUES (
                    $/kind/,
                    (
                      CASE
                        WHEN $/fillabilityStatus/ = 'filled' THEN 'filled'
                        WHEN $/fillabilityStatus/ = 'cancelled' THEN 'cancelled'
                        WHEN $/fillabilityStatus/ = 'expired' THEN 'expired'
                        WHEN $/fillabilityStatus/ = 'no-balance' THEN 'inactive'
                        WHEN $/approvalStatus/ = 'no-approval' THEN 'inactive'
                        ELSE 'active'
                      END
                    )::order_event_status_t,
                    $/contract/,
                    $/tokenSetId/,
                    $/orderId/,
                    $/orderSourceIdInt/,
                    $/validBetween/,
                    $/quantityRemaining/,
                    $/nonce/,
                    $/maker/,
                    $/price/,
                    $/value/,
                    $/txHash/,
                    $/txTimestamp/
                  )
                `, {
                            fillabilityStatus: order.fillabilityStatus,
                            approvalStatus: order.approvalStatus,
                            contract: order.contract,
                            tokenSetId: order.tokenSetId,
                            orderId: order.id,
                            orderSourceIdInt: order.sourceIdInt,
                            validBetween: order.validBetween,
                            quantityRemaining: order.quantityRemaining,
                            nonce: order.nonce,
                            maker: order.maker,
                            price: order.price,
                            value: order.value,
                            kind: trigger.kind,
                            txHash: trigger.txHash ? (0, utils_1.toBuffer)(trigger.txHash) : null,
                            txTimestamp: trigger.txTimestamp || null,
                        });
                    }
                    let eventInfo;
                    if (trigger.kind == "cancel") {
                        const eventData = {
                            orderId: order.id,
                            orderSourceIdInt: order.sourceIdInt,
                            contract: (0, utils_1.fromBuffer)(order.contract),
                            tokenId: order.tokenId,
                            maker: (0, utils_1.fromBuffer)(order.maker),
                            price: order.value,
                            amount: order.quantityRemaining,
                            transactionHash: trigger.txHash,
                            logIndex: trigger.logIndex,
                            batchIndex: trigger.batchIndex,
                            blockHash: trigger.blockHash,
                            timestamp: trigger.txTimestamp,
                        };
                        if (order.side === "sell") {
                            eventInfo = {
                                kind: processActivityEvent.EventKind.sellOrderCancelled,
                                data: eventData,
                            };
                        }
                        else if (order.side === "buy") {
                            eventInfo = {
                                kind: processActivityEvent.EventKind.buyOrderCancelled,
                                data: eventData,
                            };
                        }
                    }
                    else if (trigger.kind == "new-order" &&
                        order.fillabilityStatus == "fillable" &&
                        order.approvalStatus == "approved") {
                        const eventData = {
                            orderId: order.id,
                            orderSourceIdInt: order.sourceIdInt,
                            contract: (0, utils_1.fromBuffer)(order.contract),
                            tokenId: order.tokenId,
                            maker: (0, utils_1.fromBuffer)(order.maker),
                            price: order.value,
                            amount: order.quantityRemaining,
                            timestamp: Date.now() / 1000,
                        };
                        if (order.side === "sell") {
                            eventInfo = {
                                kind: processActivityEvent.EventKind.newSellOrder,
                                data: eventData,
                            };
                        }
                        else if (order.side === "buy") {
                            eventInfo = {
                                kind: processActivityEvent.EventKind.newBuyOrder,
                                data: eventData,
                            };
                        }
                    }
                    if (eventInfo) {
                        await processActivityEvent.addToQueue([eventInfo]);
                    }
                }
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to handle order info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 20 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (orderInfos) => {
    // Ignore empty orders
    orderInfos = orderInfos.filter(({ id }) => id !== constants_1.HashZero);
    await exports.queue.addBulk(orderInfos.map((orderInfo) => ({
        name: orderInfo.id ? orderInfo.id : orderInfo.tokenSetId + "-" + orderInfo.side,
        data: orderInfo,
        opts: {
            // We should make sure not to perform any expensive work more
            // than once. As such, we keep the last performed jobs in the
            // queue and give all jobs a deterministic id so that we skip
            // handling jobs that already got executed.
            jobId: orderInfo.context,
        },
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=by-id-queue.js.map