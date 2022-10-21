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
const constants_1 = require("@ethersproject/constants");
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const bundleOrderUpdatesByMaker = __importStar(require("@/jobs/order-updates/by-maker-bundle-queue"));
const on_chain_data_1 = require("@/utils/on-chain-data");
const QUEUE_NAME = "order-updates-by-maker";
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
        const { context, maker, trigger, data } = job.data;
        try {
            // TODO: Right now, it is assumed all results from the below queries
            // are small enough so that they can be retrieved in one go. This is
            // not going to hold for much longer so we should change the flow to
            // use keyset pagination (eg. get a batch of affected orders, handle
            // them, and then trigger the next batch). While sell side approvals
            // or balances will fit in a single batch in all cases, results from
            // the buy side can potentially span multiple batches (eg. checks on
            // the sell side will handle all of a maker's sell orders on exactly
            // a SINGLE TOKEN, while checks on the buy side will handle all of a
            // maker's buy orders on ALL TOKENS / TOKEN SETS - so buy side check
            // can potentially be more prone to not being able to handle all the
            // affected orders in a single batch).
            switch (data.kind) {
                // Handle changes in ERC20 balances (relevant for 'buy' orders)
                case "buy-balance": {
                    // Get the old and new fillability statuses of the current maker's 'buy' orders
                    const fillabilityStatuses = await db_1.idb.manyOrNone(`
                SELECT
                  orders.kind,
                  orders.id,
                  orders.fillability_status AS old_status,
                  (CASE
                    WHEN ft_balances.amount >= (orders.price * orders.quantity_remaining) THEN 'fillable'
                    ELSE 'no-balance'
                  END)::order_fillability_status_t AS new_status,
                  (CASE
                    WHEN ft_balances.amount >= (orders.price * orders.quantity_remaining) THEN nullif(upper(orders.valid_between), 'infinity')
                    ELSE to_timestamp($/timestamp/)
                  END)::timestamptz AS expiration
                FROM orders
                JOIN ft_balances
                  ON orders.maker = ft_balances.owner
                WHERE orders.maker = $/maker/
                  AND orders.side = 'buy'
                  AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                  AND ft_balances.contract = $/contract/
              `, {
                        maker: (0, utils_1.toBuffer)(maker),
                        contract: (0, utils_1.toBuffer)(data.contract),
                        timestamp: trigger.txTimestamp,
                    });
                    // Filter any orders that didn't change status
                    const values = fillabilityStatuses
                        .filter(({ old_status, new_status }) => old_status !== new_status)
                        // We mark X2Y2 orders as cancelled if the balance ever gets underwater
                        // in order to be consistent with the way they handle things (see below
                        // description on handling X2Y2 "sell-balance" changes)
                        .map((data) => data.kind === "x2y2" && data.new_status === "no-balance"
                        ? { ...data, new_status: "cancelled" }
                        : data)
                        .map(({ id, new_status, expiration }) => ({
                        id,
                        fillability_status: new_status,
                        expiration: expiration || "infinity",
                    }));
                    // Update any orders that did change status
                    if (values.length) {
                        const columns = new db_1.pgp.helpers.ColumnSet(["id", "fillability_status", "expiration"], { table: "orders" });
                        await db_1.idb.none(`
                  UPDATE orders SET
                    fillability_status = x.fillability_status::order_fillability_status_t,
                    expiration = x.expiration::TIMESTAMPTZ,
                    updated_at = now()
                  FROM (VALUES ${db_1.pgp.helpers.values(values, columns)}) AS x(id, fillability_status, expiration)
                  WHERE orders.id = x.id::TEXT
                `);
                    }
                    // Recheck all updated orders
                    await orderUpdatesById.addToQueue(fillabilityStatuses.map(({ id }) => ({
                        context: `${context}-${id}`,
                        id,
                        trigger,
                    })));
                    break;
                }
                // Handle changes in ERC20 approvals (relevant for 'buy' orders)
                case "buy-approval": {
                    if (data.operator) {
                        // If `operator` is specified, then the approval change is coming from an `Approval` event
                        // Fetch all 'buy' orders with `operator` as conduit
                        const result = await db_1.idb.manyOrNone(`
                  SELECT
                    orders.id,
                    orders.price
                  FROM orders
                  WHERE orders.maker = $/maker/
                    AND orders.side = 'buy'
                    AND orders.conduit = $/conduit/
                    AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                  LIMIT 1
                `, {
                            maker: (0, utils_1.toBuffer)(maker),
                            conduit: (0, utils_1.toBuffer)(data.operator),
                        });
                        if (result.length) {
                            // Refresh approval from on-chain data
                            await (0, on_chain_data_1.fetchAndUpdateFtApproval)(data.contract, maker, data.operator);
                            // Validate or invalidate orders based on the just-updated approval
                            const result = await db_1.idb.manyOrNone(`
                    WITH
                      x AS (
                        SELECT
                          orders.id,
                          orders.price
                        FROM orders
                        WHERE orders.maker = $/maker/
                          AND orders.side = 'buy'
                          AND orders.conduit = $/conduit/
                          AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                      ),
                      y AS (
                        SELECT
                          ft_approvals.value
                        FROM ft_approvals
                        WHERE ft_approvals.token = $/token/
                          AND ft_approvals.owner = $/maker/
                          AND ft_approvals.spender = $/conduit/
                      )
                    UPDATE orders SET
                      approval_status = (
                        CASE
                          WHEN orders.price > y.value THEN 'no-approval'
                          ELSE 'approved'
                        END
                      )::order_approval_status_t,
                      expiration = (
                        CASE
                          WHEN orders.price > y.value THEN to_timestamp($/timestamp/)
                          ELSE nullif(upper(orders.valid_between), 'infinity')
                        END
                      )::timestamptz,
                      updated_at = now()
                    FROM x
                    LEFT JOIN y ON TRUE
                    WHERE orders.id = x.id
                      AND orders.approval_status != (
                        CASE
                          WHEN orders.price > y.value THEN 'no-approval'
                          ELSE 'approved'
                        END
                      )::order_approval_status_t
                    RETURNING
                      orders.kind,
                      orders.approval_status,
                      orders.expiration,
                      orders.id
                  `, {
                                token: (0, utils_1.toBuffer)(data.contract),
                                maker: (0, utils_1.toBuffer)(maker),
                                conduit: (0, utils_1.toBuffer)(data.operator),
                                timestamp: trigger.txTimestamp,
                            });
                            const cancelledValues = result
                                .filter(
                            // When an approval gets revoked, X2Y2 will off-chain cancel all the
                            // orders from the same owner, so that if they ever re-approve, none
                            // of these orders will get reactivated (they are able to do that by
                            // having their backend refuse to sign on such orders).
                            ({ kind, approval_status }) => kind === "x2y2" && approval_status === "no-approval")
                                .map(({ id, expiration }) => ({
                                id,
                                fillability_status: "cancelled",
                                expiration: expiration || "infinity",
                            }));
                            // Cancel any orders if needed
                            if (cancelledValues.length) {
                                const columns = new db_1.pgp.helpers.ColumnSet(["id", "fillability_status", "expiration"], {
                                    table: "orders",
                                });
                                await db_1.idb.none(`
                      UPDATE orders SET
                        fillability_status = x.fillability_status::order_fillability_status_t,
                        expiration = x.expiration::TIMESTAMPTZ,
                        updated_at = now()
                      FROM (VALUES ${db_1.pgp.helpers.values(cancelledValues, columns)}) AS x(id, fillability_status, expiration)
                      WHERE orders.id = x.id::TEXT
                    `);
                            }
                            // Recheck all affected orders
                            await orderUpdatesById.addToQueue(result.map(({ id }) => ({
                                context: `${context}-${id}`,
                                id,
                                trigger,
                            })));
                        }
                    }
                    else if (data.orderKind) {
                        // Otherwise, the approval change is coming from a `Transfer` event
                        // Fetch all different conduits for the given order kind
                        const result = await db_1.idb.manyOrNone(`
                  SELECT DISTINCT
                    orders.conduit
                  FROM orders
                  WHERE orders.maker = $/maker/
                    AND orders.side = 'buy'
                    AND orders.kind = $/kind/
                    AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                `, {
                            maker: (0, utils_1.toBuffer)(maker),
                            kind: data.orderKind,
                        });
                        // Trigger a new job to individually handle all maker's conduits
                        await (0, exports.addToQueue)(result
                            .filter(({ conduit }) => Boolean(conduit))
                            .map(({ conduit }) => {
                            conduit = (0, utils_1.fromBuffer)(conduit);
                            return {
                                context: `${context}-${conduit}`,
                                maker,
                                trigger,
                                data: {
                                    kind: "buy-approval",
                                    contract: data.contract,
                                    operator: conduit,
                                },
                            };
                        }));
                    }
                    break;
                }
                // Handle changes in ERC721/ERC1155 balances (relevant for 'sell' orders)
                case "sell-balance": {
                    // Get the old and new fillability statuses of the affected orders (filter by maker + token)
                    const fillabilityStatuses = await db_1.idb.manyOrNone(`
                SELECT
                  orders.kind,
                  orders.id,
                  orders.fillability_status AS old_status,
                  (CASE
                    WHEN nft_balances.amount >= orders.quantity_remaining THEN 'fillable'
                    ELSE 'no-balance'
                  END)::order_fillability_status_t AS new_status,
                  (CASE
                    WHEN nft_balances.amount >= orders.quantity_remaining THEN nullif(upper(orders.valid_between), 'infinity')
                    ELSE to_timestamp($/timestamp/)
                  END)::TIMESTAMPTZ AS expiration
                FROM orders
                JOIN nft_balances
                  ON orders.maker = nft_balances.owner
                JOIN token_sets_tokens
                  ON orders.token_set_id = token_sets_tokens.token_set_id
                  AND nft_balances.contract = token_sets_tokens.contract
                  AND nft_balances.token_id = token_sets_tokens.token_id
                WHERE orders.maker = $/maker/
                  AND orders.side = 'sell'
                  AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                  AND nft_balances.contract = $/contract/
                  AND nft_balances.token_id = $/tokenId/
              `, {
                        maker: (0, utils_1.toBuffer)(maker),
                        contract: (0, utils_1.toBuffer)(data.contract),
                        tokenId: data.tokenId,
                        timestamp: trigger.txTimestamp,
                    });
                    // Filter any orders that didn't change status
                    const values = fillabilityStatuses
                        .filter(({ old_status, new_status }) => old_status !== new_status)
                        // Exclude escrowed orders
                        .filter(({ kind }) => kind !== "foundation" && kind !== "cryptopunks")
                        // When a token gets transferred, X2Y2 will off-chain cancel all the
                        // orders from the initial owner, so that if they ever get the token
                        // back in their wallet no order will get reactivated (they are able
                        // to do that by having their backend refuse to sign on such orders).
                        .map((data) => data.kind === "x2y2" && data.new_status === "no-balance"
                        ? { ...data, new_status: "cancelled" }
                        : data)
                        .map(({ id, new_status, expiration }) => ({
                        id,
                        fillability_status: new_status,
                        expiration: expiration || "infinity",
                    }));
                    // Update any orders that did change status
                    if (values.length) {
                        const columns = new db_1.pgp.helpers.ColumnSet(["id", "fillability_status", "expiration"], { table: "orders" });
                        await db_1.idb.none(`
                  UPDATE orders SET
                    fillability_status = x.fillability_status::order_fillability_status_t,
                    expiration = x.expiration::TIMESTAMPTZ,
                    updated_at = now()
                  FROM (VALUES ${db_1.pgp.helpers.values(values, columns)}) AS x(id, fillability_status, expiration)
                  WHERE orders.id = x.id::TEXT
                `);
                    }
                    // Recheck all affected orders
                    await orderUpdatesById.addToQueue(fillabilityStatuses.map(({ id }) => ({
                        context: `${context}-${id}`,
                        id,
                        trigger,
                    })));
                    // Revalidate any bundles
                    await bundleOrderUpdatesByMaker.addToQueue([job.data]);
                    break;
                }
                // Handle changes in ERC721/ERC1155 approvals (relevant for 'sell' orders)
                case "sell-approval": {
                    const approvalStatuses = await db_1.idb.manyOrNone(`
                SELECT
                  orders.id,
                  orders.kind,
                  orders.approval_status AS old_status,
                  x.new_status,
                  x.expiration
                FROM orders
                JOIN LATERAL (
                  SELECT
                    (CASE
                      WHEN nft_approval_events.approved THEN 'approved'
                      ELSE 'no-approval'
                    END)::order_approval_status_t AS new_status,
                    (CASE
                      WHEN nft_approval_events.approved THEN nullif(upper(orders.valid_between), 'infinity')
                      ELSE to_timestamp($/timestamp/)
                    END)::TIMESTAMPTZ AS expiration
                  FROM nft_approval_events
                  WHERE nft_approval_events.address = orders.contract
                    AND nft_approval_events.owner = orders.maker
                    AND nft_approval_events.operator = orders.conduit
                  ORDER BY nft_approval_events.block DESC
                  LIMIT 1
                ) x ON TRUE
                WHERE orders.contract = $/contract/
                  AND orders.maker = $/maker/
                  AND orders.side = 'sell'
                  AND orders.conduit = $/operator/
                  AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
              `, {
                        maker: (0, utils_1.toBuffer)(maker),
                        contract: (0, utils_1.toBuffer)(data.contract),
                        operator: (0, utils_1.toBuffer)(data.operator),
                        timestamp: trigger.txTimestamp,
                    });
                    // Filter any orders that didn't change status
                    const values = approvalStatuses
                        .filter(({ old_status, new_status }) => old_status !== new_status)
                        // Exclude escrowed orders
                        .filter(({ kind }) => kind !== "foundation" && kind !== "cryptopunks")
                        .map(({ id, new_status, expiration }) => ({
                        id,
                        approval_status: new_status,
                        expiration: expiration || "infinity",
                    }));
                    // Update any orders that did change status
                    if (values.length) {
                        const columns = new db_1.pgp.helpers.ColumnSet(["id", "approval_status", "expiration"], {
                            table: "orders",
                        });
                        await db_1.idb.none(`
                  UPDATE orders SET
                    approval_status = x.approval_status::order_approval_status_t,
                    expiration = x.expiration::TIMESTAMPTZ,
                    updated_at = now()
                  FROM (VALUES ${db_1.pgp.helpers.values(values, columns)}) AS x(id, approval_status, expiration)
                  WHERE orders.id = x.id::TEXT
                `);
                    }
                    const cancelledValues = approvalStatuses
                        .filter(
                    // When an approval gets revoked, X2Y2 will off-chain cancel all the
                    // orders from the same owner, so that if they ever re-approve, none
                    // of these orders will get reactivated (they are able to do that by
                    // having their backend refuse to sign on such orders).
                    ({ kind, new_status }) => kind === "x2y2" && new_status === "no-approval")
                        .map(({ id, expiration }) => ({
                        id,
                        fillability_status: "cancelled",
                        expiration: expiration || "infinity",
                    }));
                    // Cancel any orders if needed
                    if (cancelledValues.length) {
                        const columns = new db_1.pgp.helpers.ColumnSet(["id", "fillability_status", "expiration"], {
                            table: "orders",
                        });
                        await db_1.idb.none(`
                  UPDATE orders SET
                    fillability_status = x.fillability_status::order_fillability_status_t,
                    expiration = x.expiration::TIMESTAMPTZ,
                    updated_at = now()
                  FROM (VALUES ${db_1.pgp.helpers.values(cancelledValues, columns)}) AS x(id, fillability_status, expiration)
                  WHERE orders.id = x.id::TEXT
                `);
                    }
                    // Recheck all affected orders
                    await orderUpdatesById.addToQueue(approvalStatuses.map(({ id }) => ({
                        context: `${context}-${id}`,
                        id,
                        trigger,
                    })));
                    // Revalidate any bundles
                    await bundleOrderUpdatesByMaker.addToQueue([job.data]);
                    break;
                }
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to handle maker info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 30 });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
const addToQueue = async (makerInfos) => {
    // Ignore empty makers
    makerInfos = makerInfos.filter(({ maker }) => maker !== constants_1.AddressZero);
    await exports.queue.addBulk(makerInfos.map((makerInfo) => ({
        name: makerInfo.maker,
        data: makerInfo,
        opts: {
            // We should make sure not to perform any expensive work more
            // than once. As such, we keep the last performed jobs in the
            // queue and give all jobs a deterministic id so that we skip
            // handling jobs that already got executed.
            jobId: makerInfo.context,
        },
    })));
};
exports.addToQueue = addToQueue;
//# sourceMappingURL=by-maker-queue.js.map