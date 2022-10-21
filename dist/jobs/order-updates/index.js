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
const Sdk = __importStar(require("@reservoir0x/sdk"));
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const prices_1 = require("@/utils/prices");
// Whenever an order changes its state (eg. a new order comes in,
// a fill/cancel happens, an order gets expired, or an order gets
// revalidated/invalidated due to a change in balance or approval
// we might want to take some actions (eg. update any caches). As
// for events syncing, we have two separate job queues. The first
// one is for handling direct order state changes (cancels, fills
// or expirations - where we know the exact id of the orders that
// are affected), while the other is for indirect change of state
// - where we don't know the exact ids of the affected orders and
// some additional processing is required (eg. on balance changes
// many of the orders of a maker might change their state).
require("@/jobs/order-updates/by-id-queue");
require("@/jobs/order-updates/by-maker-queue");
require("@/jobs/order-updates/by-maker-bundle-queue");
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    // Handle expired orders
    node_cron_1.default.schedule("*/10 * * * * *", async () => await redis_1.redlock
        .acquire(["expired-orders-check-lock"], (10 - 5) * 1000)
        .then(async () => {
        logger_1.logger.info("expired-orders-check", "Invalidating expired orders");
        try {
            const expiredOrders = await db_1.idb.manyOrNone(`
                WITH x AS (
                  SELECT
                    orders.id,
                    upper(orders.valid_between) AS expiration
                  FROM orders
                  WHERE upper(orders.valid_between) < now()
                    AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                  LIMIT 500
                )
                UPDATE orders SET
                  fillability_status = 'expired',
                  expiration = x.expiration,
                  updated_at = now()
                FROM x
                WHERE orders.id = x.id
                RETURNING orders.id
              `);
            logger_1.logger.info("expired-orders-check", `Invalidated ${expiredOrders.length} orders`);
            const currentTime = (0, utils_1.now)();
            await orderUpdatesById.addToQueue(expiredOrders.map(({ id }) => ({
                context: `expired-orders-check-${currentTime}-${id}`,
                id,
                trigger: { kind: "expiry" },
            })));
        }
        catch (error) {
            logger_1.logger.error(`expired-orders-check`, `Failed to handle expired orders: ${error}`);
        }
    })
        .catch(() => {
        // Skip on any errors
    }));
    // TODO: Move the below cron jobs to job queues so that deployments don't impact them
    // Handle dynamic orders
    node_cron_1.default.schedule("*/10 * * * *", async () => await redis_1.redlock
        .acquire(["dynamic-orders-update-lock"], 10 * 60 * 1000)
        .then(async () => {
        logger_1.logger.info(`dynamic-orders-update`, "Updating dynamic orders");
        try {
            let continuation;
            const limit = 500;
            let done = false;
            while (!done) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const dynamicOrders = await db_1.idb.manyOrNone(`
                    SELECT
                      orders.id,
                      orders.kind,
                      orders.currency,
                      orders.raw_data
                    FROM orders
                    WHERE orders.dynamic
                      AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                      ${continuation ? "AND orders.id > $/continuation/" : ""}
                    ORDER BY orders.id
                    LIMIT ${limit}
                  `, { continuation });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const values = [];
                for (const { id, kind, currency, raw_data } of dynamicOrders) {
                    if (kind === "seaport") {
                        const order = new Sdk.Seaport.Order(index_1.config.chainId, raw_data);
                        const newCurrencyPrice = order.getMatchingPrice().toString();
                        const prices = await (0, prices_1.getUSDAndNativePrices)((0, utils_1.fromBuffer)(currency), newCurrencyPrice, (0, utils_1.now)());
                        if (prices.nativePrice) {
                            values.push({
                                id,
                                price: prices.nativePrice,
                                currency_price: newCurrencyPrice,
                                // TODO: We should have a generic method for deriving the `value` from `price`
                                value: prices.nativePrice,
                                currency_value: newCurrencyPrice,
                            });
                        }
                    }
                }
                const columns = new db_1.pgp.helpers.ColumnSet([
                    "?id",
                    { name: "price", cast: "NUMERIC(78, 0)" },
                    { name: "currency_price", cast: "NUMERIC(78, 0)" },
                    { name: "value", cast: "NUMERIC(78, 0)" },
                    { name: "currency_value", cast: "NUMERIC(78, 0) " },
                ], {
                    table: "orders",
                });
                if (values.length) {
                    await db_1.idb.none(db_1.pgp.helpers.update(values, columns) + " WHERE t.id = v.id");
                }
                const currentTime = (0, utils_1.now)();
                await orderUpdatesById.addToQueue(dynamicOrders.map(({ id }) => ({
                    context: `dynamic-orders-update-${currentTime}-${id}`,
                    id,
                    trigger: { kind: "reprice" },
                })));
                if (dynamicOrders.length >= limit) {
                    continuation = dynamicOrders[dynamicOrders.length - 1].id;
                }
                else {
                    done = true;
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`dynamic-orders-update`, `Failed to handle dynamic orders: ${error}`);
        }
    })
        .catch(() => {
        // Skip on any errors
    }));
    // Handle ERC20 orders
    node_cron_1.default.schedule(
    // The cron frequency should match the granularity of the price data (eg. once per day for now)
    "0 0 1 * * *", async () => await redis_1.redlock
        .acquire(["erc20-orders-update-lock"], 10 * 60 * 1000)
        .then(async () => {
        logger_1.logger.info(`erc20-orders-update`, "Updating ERC20 order prices");
        try {
            let continuation;
            const limit = 500;
            let done = false;
            while (!done) {
                const erc20Orders = await db_1.idb.manyOrNone(`
                  SELECT
                    orders.id,
                    orders.currency,
                    orders.currency_price,
                    orders.currency_value
                  FROM orders
                  WHERE orders.needs_conversion
                    AND orders.fillability_status = 'fillable'
                    AND orders.approval_status = 'approved'
                    ${continuation ? "AND orders.id > $/continuation/" : ""}
                  ORDER BY orders.id
                  LIMIT ${limit}
                `, { continuation });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const values = [];
                const currentTime = (0, utils_1.now)();
                for (const { id, currency, currency_price, currency_value } of erc20Orders) {
                    const dataForPrice = await (0, prices_1.getUSDAndNativePrices)((0, utils_1.fromBuffer)(currency), currency_price, currentTime);
                    const dataForValue = await (0, prices_1.getUSDAndNativePrices)((0, utils_1.fromBuffer)(currency), currency_value, currentTime);
                    if (dataForPrice.nativePrice && dataForValue.nativePrice) {
                        values.push({
                            id,
                            price: dataForPrice.nativePrice,
                            value: dataForValue.nativePrice,
                        });
                    }
                }
                const columns = new db_1.pgp.helpers.ColumnSet([
                    "?id",
                    { name: "price", cast: "numeric(78, 0)" },
                    { name: "value", cast: "numeric(78, 0)" },
                ], {
                    table: "orders",
                });
                if (values.length) {
                    await db_1.idb.none(db_1.pgp.helpers.update(values, columns) + " WHERE t.id = v.id");
                }
                await orderUpdatesById.addToQueue(erc20Orders.map(({ id }) => ({
                    context: `erc20-orders-update-${utils_1.now}-${id}`,
                    id,
                    trigger: { kind: "reprice" },
                })));
                if (erc20Orders.length >= limit) {
                    continuation = erc20Orders[erc20Orders.length - 1].id;
                }
                else {
                    done = true;
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`dynamic-orders-update`, `Failed to handle dynamic orders: ${error}`);
        }
    })
        .catch(() => {
        // Skip on any errors
    }));
}
//# sourceMappingURL=index.js.map