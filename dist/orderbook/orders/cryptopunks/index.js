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
exports.save = exports.getOrderId = void 0;
const constants_1 = require("@ethersproject/constants");
const solidity_1 = require("@ethersproject/solidity");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const p_limit_1 = __importDefault(require("p-limit"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const ordersUpdateById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const utils_2 = require("@/orderbook/orders/utils");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const sources_1 = require("@/models/sources");
const getOrderId = (tokenId) => (0, solidity_1.keccak256)(["string", "uint256"], ["cryptopunks", tokenId]);
exports.getOrderId = getOrderId;
const save = async (orderInfos) => {
    const results = [];
    const orderValues = [];
    const handleOrder = async ({ orderParams, metadata }) => {
        var _a, _b, _c;
        try {
            // We can only have a single currently active order per token
            const id = (0, exports.getOrderId)(orderParams.tokenId);
            // We only support listings at the moment
            if (orderParams.side !== "sell") {
                return results.push({
                    id,
                    status: "unsupported-side",
                });
            }
            // Ensure that the order is not cancelled
            const cancelResult = await db_1.redb.oneOrNone(`
          SELECT 1 FROM cancel_events
          WHERE order_id = $/id/
            AND timestamp >= $/timestamp/
          LIMIT 1
        `, { id, timestamp: orderParams.txTimestamp });
            if (cancelResult) {
                return results.push({
                    id,
                    txHash: orderParams.txHash,
                    status: "redundant",
                });
            }
            // Ensure that the order is not filled
            const fillResult = await db_1.redb.oneOrNone(`
          SELECT 1 FROM fill_events_2
          WHERE order_id = $/id/
            AND timestamp >= $/timestamp/
          LIMIT 1
        `, { id, timestamp: orderParams.txTimestamp });
            if (fillResult) {
                return results.push({
                    id,
                    txHash: orderParams.txHash,
                    status: "redundant",
                });
            }
            const orderResult = await db_1.redb.oneOrNone(`
          SELECT
            extract('epoch' from lower(orders.valid_between)) AS valid_from
          FROM orders
          WHERE orders.id = $/id/
        `, { id });
            if (orderResult) {
                if (Number(orderResult.valid_from) < orderParams.txTimestamp) {
                    // If an older order already exists then we just update some fields on it
                    await db_1.idb.none(`
              UPDATE orders SET
                fillability_status = 'fillable',
                maker = $/maker/,
                price = $/price/,
                currency_price = $/price/,
                value = $/price/,
                currency_value = $/price/,
                valid_between = tstzrange(date_trunc('seconds', to_timestamp(${orderParams.txTimestamp})), 'Infinity', '[]'),
                expiration = 'Infinity',
                updated_at = now(),
                taker = $/taker/,
                raw_data = $/orderParams:json/
              WHERE orders.id = $/id/
            `, {
                        maker: (0, utils_1.toBuffer)(orderParams.maker),
                        taker: (0, utils_1.toBuffer)((_a = orderParams.taker) !== null && _a !== void 0 ? _a : constants_1.AddressZero),
                        price: orderParams.price,
                        orderParams,
                        id,
                    });
                    return results.push({
                        id,
                        txHash: orderParams.txHash,
                        status: "success",
                    });
                }
                else {
                    // If a newer order already exists, then we just skip processing
                    return results.push({
                        id,
                        txHash: orderParams.txHash,
                        status: "redundant",
                    });
                }
            }
            // Check and save: associated token set
            const schemaHash = (_b = metadata.schemaHash) !== null && _b !== void 0 ? _b : (0, utils_2.generateSchemaHash)(metadata.schema);
            const contract = Sdk.CryptoPunks.Addresses.Exchange[index_1.config.chainId];
            const [{ id: tokenSetId }] = await tokenSet.singleToken.save([
                {
                    id: `token:${contract}:${orderParams.tokenId}`,
                    schemaHash,
                    contract: contract,
                    tokenId: orderParams.tokenId,
                },
            ]);
            // Handle: source
            const sources = await sources_1.Sources.getInstance();
            let source = await sources.getOrInsert("cryptopunks.app");
            if (metadata.source) {
                source = await sources.getOrInsert(metadata.source);
            }
            const validFrom = `date_trunc('seconds', to_timestamp(${orderParams.txTimestamp}))`;
            const validTo = `'Infinity'`;
            orderValues.push({
                id,
                kind: "cryptopunks",
                side: orderParams.side,
                fillability_status: "fillable",
                approval_status: "approved",
                token_set_id: tokenSetId,
                token_set_schema_hash: (0, utils_1.toBuffer)(schemaHash),
                maker: (0, utils_1.toBuffer)(orderParams.maker),
                taker: (0, utils_1.toBuffer)((_c = orderParams.taker) !== null && _c !== void 0 ? _c : constants_1.AddressZero),
                price: orderParams.price.toString(),
                value: orderParams.price.toString(),
                currency: (0, utils_1.toBuffer)(Sdk.Common.Addresses.Eth[index_1.config.chainId]),
                currency_price: orderParams.price.toString(),
                currency_value: orderParams.price.toString(),
                needs_conversion: null,
                quantity_remaining: "1",
                valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
                nonce: null,
                source_id_int: source === null || source === void 0 ? void 0 : source.id,
                is_reservoir: null,
                contract: (0, utils_1.toBuffer)(contract),
                conduit: null,
                fee_bps: 0,
                fee_breakdown: [],
                dynamic: null,
                raw_data: orderParams,
                expiration: validTo,
            });
            return results.push({
                id,
                txHash: orderParams.txHash,
                status: "success",
            });
        }
        catch (error) {
            logger_1.logger.error("orders-cryptopunks-save", `Failed to handle order with params ${JSON.stringify(orderParams)}: ${error}`);
        }
    };
    // Process all orders concurrently
    const limit = (0, p_limit_1.default)(20);
    await Promise.all(orderInfos.map((orderInfo) => limit(() => handleOrder(orderInfo))));
    if (orderValues.length) {
        const columns = new db_1.pgp.helpers.ColumnSet([
            "id",
            "kind",
            "side",
            "fillability_status",
            "approval_status",
            "token_set_id",
            "token_set_schema_hash",
            "maker",
            "taker",
            "price",
            "value",
            "currency",
            "currency_price",
            "currency_value",
            "needs_conversion",
            "quantity_remaining",
            { name: "valid_between", mod: ":raw" },
            "nonce",
            "source_id_int",
            "is_reservoir",
            "contract",
            "fee_bps",
            { name: "fee_breakdown", mod: ":json" },
            "dynamic",
            "raw_data",
            { name: "expiration", mod: ":raw" },
        ], {
            table: "orders",
        });
        await db_1.idb.none(db_1.pgp.helpers.insert(orderValues, columns) + " ON CONFLICT DO NOTHING");
        await ordersUpdateById.addToQueue(results.map(({ id, txHash }) => ({
            context: `new-order-${id}-${txHash}`,
            id,
            trigger: {
                kind: "new-order",
            },
        })));
    }
    return results;
};
exports.save = save;
//# sourceMappingURL=index.js.map