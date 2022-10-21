"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignWashTradingScoreToFillEvents = exports.assignSourceToFillEvents = void 0;
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const network_1 = require("@/config/network");
// By default, each fill event is assigned a default order source
// based on the order kind. However, that is not accurate at all,
// so the below code will join any fill events that have an order
// id which is not null to the orders table and get the accurate
// order source from there.
const assignSourceToFillEvents = async (fillEvents) => {
    try {
        // Fetch the order ids associated to the passed in fill events
        const orderIds = fillEvents.map((e) => e.orderId).filter(Boolean);
        if (orderIds.length) {
            const orders = [];
            // Get the associated source for each of the above orders
            const orderIdChunks = lodash_1.default.chunk(orderIds, 100);
            for (const chunk of orderIdChunks) {
                const ordersChunk = await db_1.redb.manyOrNone(`
            SELECT
              orders.id,
              orders.source_id_int
            FROM orders
            WHERE orders.id IN ($/orderIds:list/)
              AND orders.source_id_int IS NOT NULL
          `, { orderIds: chunk });
                orders.push(...ordersChunk);
            }
            if (orders.length) {
                // Create a mapping from order id to its source id
                const orderSourceIdByOrderId = new Map();
                for (const order of orders) {
                    orderSourceIdByOrderId.set(order.id, order.source_id_int);
                }
                fillEvents.forEach((event) => {
                    if (!event.orderId) {
                        return;
                    }
                    // If the current fill event's order has an associated source,
                    // then use that as the order source for the fill event
                    const orderSourceId = orderSourceIdByOrderId.get(event.orderId);
                    if (orderSourceId) {
                        event.orderSourceId = orderSourceId;
                        // If the fill event has no aggregator or fill source,
                        // then default the fill source to the order source
                        if (!event.aggregatorSourceId && !event.fillSourceId) {
                            event.fillSourceId = orderSourceId;
                        }
                        logger_1.logger.info("assign-source-to-fill-events", `Source id ${orderSourceId} assigned to fill event: ${JSON.stringify(event)}`);
                    }
                });
            }
        }
    }
    catch (error) {
        logger_1.logger.error("assign-source-to-fill-events", `Failed to assign sources to fill events: ${error}`);
    }
};
exports.assignSourceToFillEvents = assignSourceToFillEvents;
// Each fill event is assigned a wash trading score which is used
// for filtering any wash trading sales from the calculation made
// by the collection volumes processes
const assignWashTradingScoreToFillEvents = async (fillEvents) => {
    const ns = (0, network_1.getNetworkSettings)();
    try {
        const inverseFillEvents = [];
        const washTradingExcludedContracts = ns.washTradingExcludedContracts;
        const washTradingWhitelistedAddresses = ns.washTradingWhitelistedAddresses;
        const washTradingBlacklistedAddresses = ns.washTradingBlacklistedAddresses;
        // Filter events that don't need to be checked for inverse sales
        const fillEventsPendingInverseCheck = fillEvents.filter((e) => !washTradingExcludedContracts.includes(e.contract) &&
            !washTradingWhitelistedAddresses.includes(e.maker) &&
            !washTradingWhitelistedAddresses.includes(e.taker) &&
            !washTradingBlacklistedAddresses.includes(e.maker) &&
            !washTradingBlacklistedAddresses.includes(e.taker));
        const fillEventsPendingInverseCheckChunks = lodash_1.default.chunk(fillEventsPendingInverseCheck, 100);
        for (const fillEventsChunk of fillEventsPendingInverseCheckChunks) {
            // TODO: We should never use `raw` queries
            const inverseFillEventsFilter = fillEventsChunk.map((fillEvent) => `('${lodash_1.default.replace(fillEvent.taker, "0x", "\\x")}', '${lodash_1.default.replace(fillEvent.maker, "0x", "\\x")}', '${lodash_1.default.replace(fillEvent.contract, "0x", "\\x")}')`);
            const inverseFillEventsChunkQuery = db_1.pgp.as.format(`
          SELECT DISTINCT contract, maker, taker from fill_events_2
          WHERE (maker, taker, contract) IN ($/inverseFillEventsFilter:raw/)
        `, {
                inverseFillEventsFilter: inverseFillEventsFilter.join(","),
            });
            const inverseFillEventsChunk = await db_1.redb.manyOrNone(inverseFillEventsChunkQuery);
            inverseFillEvents.push(...inverseFillEventsChunk);
        }
        fillEvents.forEach((event, index) => {
            // Mark event as wash trading for any blacklisted addresses
            let washTradingDetected = washTradingBlacklistedAddresses.includes(event.maker) ||
                washTradingBlacklistedAddresses.includes(event.taker);
            if (!washTradingDetected) {
                // Mark event as wash trading if we find a corresponding transfer from taker
                washTradingDetected = inverseFillEvents.some((inverseFillEvent) => {
                    return (event.maker == (0, utils_1.fromBuffer)(inverseFillEvent.taker) &&
                        event.taker == (0, utils_1.fromBuffer)(inverseFillEvent.maker) &&
                        event.contract == (0, utils_1.fromBuffer)(inverseFillEvent.contract));
                });
            }
            if (washTradingDetected) {
                logger_1.logger.info("assign-wash-trading-score-to-fill-events", `Wash trading detected on event: ${JSON.stringify(event)}`);
            }
            fillEvents[index].washTradingScore = Number(washTradingDetected);
        });
    }
    catch (error) {
        logger_1.logger.error("assign-wash-trading-score-to-fill-events", `Failed to assign wash trading scores to fill events: ${error}`);
    }
};
exports.assignWashTradingScoreToFillEvents = assignWashTradingScoreToFillEvents;
//# sourceMappingURL=fills.js.map