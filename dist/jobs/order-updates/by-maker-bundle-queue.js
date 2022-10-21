"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.queue = void 0;
const constants_1 = require("@ethersproject/constants");
const bullmq_1 = require("bullmq");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const QUEUE_NAME = "bundle-order-updates-by-maker";
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
        const { maker, trigger, data } = job.data;
        const makerHasBundles = await db_1.idb.oneOrNone(`
          SELECT 1 FROM orders
          WHERE orders.maker = $/maker/
            AND orders.side = 'bundle'
            AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
        `, {
            maker: (0, utils_1.toBuffer)(maker),
        });
        if (!makerHasBundles) {
            // Return early if the maker doesn't have any bundles
            return;
        }
        try {
            // TODO: For validation efficiency, we should maybe store the status
            // of every bundle item individually (eg. fillability and approval),
            // so that there is no need to revalidate everything on each change.
            switch (data.kind) {
                // Handle changes in ERC721/ERC1155 balances
                case "sell-balance": {
                    // Get the old and new fillability statuses of the affected orders (filter by maker + token)
                    const fillabilityStatuses = await db_1.idb.manyOrNone(`
                WITH x AS (
                  SELECT DISTINCT ON (orders.id)
                    orders.id,
                    orders.maker,
                    orders.fillability_status,
                    orders.offer_bundle_id,
                    orders.valid_between,
                    orders.expiration
                  FROM orders
                  JOIN bundle_items
                    ON orders.offer_bundle_id = bundle_items.bundle_id
                  JOIN token_sets_tokens
                    ON bundle_items.token_set_id = token_sets_tokens.token_set_id
                  WHERE orders.maker = $/maker/
                    AND orders.side = 'bundle'
                    AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                    AND token_sets_tokens.contract = $/contract/
                    AND token_sets_tokens.token_id = $/tokenId/
                )
                SELECT
                  x.id,
                  array_agg(x.fillability_status)::TEXT[] AS old_statuses,
                  array_agg((CASE
                    WHEN bundle_items.kind = 'nft' AND nft_balances.amount >= bundle_items.amount THEN 'fillable'
                    WHEN bundle_items.kind = 'ft' AND ft_balances.amount >= bundle_items.amount THEN 'fillable'
                    ELSE 'no-balance'
                  END)::order_fillability_status_t)::TEXT[] AS new_statuses,
                  array_agg((CASE
                    WHEN bundle_items.kind = 'nft' AND nft_balances.amount >= bundle_items.amount THEN upper(x.valid_between)
                    WHEN bundle_items.kind = 'ft' AND ft_balances.amount >= bundle_items.amount THEN upper(x.valid_between)
                    ELSE least(x.expiration, to_timestamp($/timestamp/))
                  END)::timestamptz)::TEXT[] AS expirations
                FROM x
                JOIN bundle_items
                  ON x.offer_bundle_id = bundle_items.bundle_id
                JOIN token_sets_tokens
                  ON bundle_items.token_set_id = token_sets_tokens.token_set_id
                LEFT JOIN nft_balances
                  ON x.maker = nft_balances.owner
                  AND token_sets_tokens.contract = nft_balances.contract
                  AND token_sets_tokens.token_id = nft_balances.token_id
                LEFT JOIN ft_balances
                  ON x.maker = nft_balances.owner
                  AND token_sets_tokens.contract = ft_balances.contract
                GROUP BY x.id
              `, {
                        maker: (0, utils_1.toBuffer)(maker),
                        contract: (0, utils_1.toBuffer)(data.contract),
                        tokenId: data.tokenId,
                        timestamp: trigger.txTimestamp,
                    });
                    // Filter any orders that didn't change status
                    const values = fillabilityStatuses
                        .filter(({ old_statuses, new_statuses }) => {
                        for (let i = 0; i < Math.min(old_statuses.length, new_statuses.length); i++) {
                            if (old_statuses[i] !== new_statuses[i]) {
                                return true;
                            }
                        }
                        return false;
                    })
                        .map(({ id, new_statuses, expirations }) => {
                        let unfillableIndex = -1;
                        for (let i = 0; i < new_statuses.length; i++) {
                            if (new_statuses[i] !== "fillable") {
                                unfillableIndex = i;
                                break;
                            }
                        }
                        return {
                            id,
                            fillability_status: unfillableIndex === -1 ? "fillable" : "no-balance",
                            expiration: (unfillableIndex === -1 ? expirations[0] : expirations[unfillableIndex]) ||
                                "infinity",
                        };
                    });
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
                    break;
                }
                // Handle changes in ERC721/ERC1155 approvals (relevant for 'sell' orders)
                case "sell-approval": {
                    const approvalStatus = await db_1.idb.manyOrNone(`
                WITH x AS (
                  SELECT DISTINCT ON (orders.id)
                    orders.id,
                    orders.maker,
                    orders.conduit,
                    orders.approval_status,
                    orders.offer_bundle_id,
                    orders.valid_between,
                    orders.expiration
                  FROM orders
                  JOIN bundle_items
                    ON orders.offer_bundle_id = bundle_items.bundle_id
                  JOIN token_sets_tokens
                    ON bundle_items.token_set_id = token_sets_tokens.token_set_id
                  WHERE orders.maker = $/maker/
                    AND orders.side = 'bundle'
                    AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                    AND token_sets_tokens.contract = $/contract/
                )
                SELECT
                  x.id,
                  array_agg(x.approval_status)::TEXT[] AS old_statuses,
                  array_agg((CASE
                    WHEN bundle_items.kind = 'nft' AND y.approved THEN 'approved'
                    WHEN bundle_items.kind = 'ft' AND ft_approvals.value >= bundle_items.amount THEN 'approved'
                    ELSE 'no-approval'
                  END)::order_approval_status_t)::TEXT[] AS new_statuses,
                  array_agg((CASE
                    WHEN bundle_items.kind = 'nft' AND y.approved THEN upper(x.valid_between)
                    WHEN bundle_items.kind = 'ft' AND ft_approvals.value >= bundle_items.amount THEN upper(x.valid_between)
                    ELSE least(x.expiration, to_timestamp($/timestamp/))
                  END)::timestamptz)::TEXT[] AS expirations
                FROM x
                JOIN bundle_items
                  ON x.offer_bundle_id = bundle_items.bundle_id
                JOIN token_sets_tokens
                  ON bundle_items.token_set_id = token_sets_tokens.token_set_id
                LEFT JOIN ft_approvals
                  ON x.maker = ft_approvals.owner
                  AND x.conduit = ft_approvals.spender
                  AND token_sets_tokens.contract = ft_approvals.token
                LEFT JOIN LATERAL (
                  SELECT
                    nft_approval_events.approved
                  FROM nft_approval_events
                  WHERE nft_approval_events.address = token_sets_tokens.contract
                    AND nft_approval_events.owner = x.maker
                    AND nft_approval_events.operator = x.conduit
                  ORDER BY nft_approval_events.block DESC
                  LIMIT 1
                ) y ON TRUE
                GROUP BY x.id
              `, {
                        maker: (0, utils_1.toBuffer)(maker),
                        contract: (0, utils_1.toBuffer)(data.contract),
                        operator: (0, utils_1.toBuffer)(data.operator),
                        timestamp: trigger.txTimestamp,
                    });
                    // Filter any orders that didn't change status
                    const values = approvalStatus
                        .filter(({ old_statuses, new_statuses }) => {
                        for (let i = 0; i < Math.min(old_statuses.length, new_statuses.length); i++) {
                            if (old_statuses[i] !== new_statuses[i]) {
                                return true;
                            }
                        }
                        return false;
                    })
                        .map(({ id, new_statuses, expirations }) => {
                        let unfillableIndex = -1;
                        for (let i = 0; i < new_statuses.length; i++) {
                            if (new_statuses[i] !== "approved") {
                                unfillableIndex = i;
                                break;
                            }
                        }
                        return {
                            id,
                            approval_status: unfillableIndex === -1 ? "approved" : "no-approval",
                            expiration: (unfillableIndex === -1 ? expirations[0] : expirations[unfillableIndex]) ||
                                "infinity",
                        };
                    });
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
                    break;
                }
            }
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Failed to handle bundle maker info ${JSON.stringify(job.data)}: ${error}`);
            throw error;
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 10 });
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
//# sourceMappingURL=by-maker-bundle-queue.js.map