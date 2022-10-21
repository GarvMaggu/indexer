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
const sources_1 = require("@/models/sources");
const utils_2 = require("@/orderbook/orders/utils");
const check_1 = require("@/orderbook/orders/zora/check");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
function getOrderId(orderParams) {
    const orderId = (0, solidity_1.keccak256)(["string", "string", "uint256"], ["zora-v3", orderParams.tokenContract, orderParams.tokenId]);
    return orderId;
}
exports.getOrderId = getOrderId;
const save = async (orderInfos) => {
    const results = [];
    const orderValues = [];
    const handleOrder = async ({ orderParams, metadata }) => {
        var _a;
        try {
            const id = getOrderId(orderParams);
            // Check: order doesn't already exist
            const orderResult = await db_1.redb.oneOrNone(` 
          SELECT 
            extract('epoch' from lower(orders.valid_between)) AS valid_from,
            fillability_status
          FROM orders 
          WHERE orders.id = $/id/ 
        `, { id });
            // Check: sell order has Eth as payment token
            if (orderParams.askCurrency !== Sdk.Common.Addresses.Eth[index_1.config.chainId]) {
                if (!orderResult) {
                    return results.push({
                        id,
                        txHash: orderParams.txHash,
                        status: "unsupported-payment-token",
                    });
                }
                else {
                    // If the order already exists set its fillability status as cancelled
                    // See https://github.com/reservoirprotocol/indexer/pull/1903/files#r976148340
                    await db_1.idb.none(`
              UPDATE orders SET
                fillability_status = $/fillability_status/,
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
                        fillability_status: "cancelled",
                        maker: (0, utils_1.toBuffer)(orderParams.maker),
                        taker: (0, utils_1.toBuffer)(constants_1.AddressZero),
                        price: orderParams.askPrice,
                        orderParams,
                        id,
                    });
                    return results.push({
                        id,
                        txHash: orderParams.txHash,
                        status: "success",
                    });
                }
            }
            // Check: order fillability
            let fillabilityStatus = "fillable";
            let approvalStatus = "approved";
            try {
                await (0, check_1.offChainCheck)(orderParams, { onChainApprovalRecheck: true });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }
            catch (error) {
                // Keep any orders that can potentially get valid in the future
                if (error.message === "no-balance-no-approval") {
                    fillabilityStatus = "no-balance";
                    approvalStatus = "no-approval";
                }
                else if (error.message === "no-approval") {
                    approvalStatus = "no-approval";
                }
                else if (error.message === "no-balance") {
                    fillabilityStatus = "no-balance";
                }
                else {
                    return results.push({
                        id,
                        txHash: orderParams.txHash,
                        status: "not-fillable",
                    });
                }
            }
            if (orderResult) {
                if (Number(orderResult.valid_from) < orderParams.txTimestamp) {
                    // If an older order already exists then we just update some fields on it
                    await db_1.idb.none(`
            UPDATE orders SET
              fillability_status = $/fillability_status/,
              approval_status = $/approval_status/,
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
                        fillability_status: fillabilityStatus,
                        approval_status: approvalStatus,
                        maker: (0, utils_1.toBuffer)(orderParams.maker),
                        taker: (0, utils_1.toBuffer)(constants_1.AddressZero),
                        price: orderParams.askPrice,
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
            const schemaHash = (_a = metadata.schemaHash) !== null && _a !== void 0 ? _a : (0, utils_2.generateSchemaHash)(metadata.schema);
            const contract = orderParams.tokenContract;
            const [{ id: tokenSetId }] = await tokenSet.singleToken.save([
                {
                    id: `token:${contract}:${orderParams.tokenId}`,
                    schemaHash,
                    contract: contract,
                    tokenId: orderParams.tokenId.toString(),
                },
            ]);
            // Handle: source
            const sources = await sources_1.Sources.getInstance();
            let source = await sources.getOrInsert("zora.co");
            if (metadata.source) {
                source = await sources.getOrInsert(metadata.source);
            }
            const validFrom = `date_trunc('seconds', to_timestamp(${orderParams.txTimestamp}))`;
            const validTo = `'Infinity'`;
            orderValues.push({
                id,
                kind: "zora-v3",
                side: orderParams.side,
                fillability_status: fillabilityStatus,
                approval_status: approvalStatus,
                token_set_id: tokenSetId,
                token_set_schema_hash: (0, utils_1.toBuffer)(schemaHash),
                maker: (0, utils_1.toBuffer)(orderParams.maker),
                taker: (0, utils_1.toBuffer)(constants_1.AddressZero),
                price: orderParams.askPrice.toString(),
                value: orderParams.askPrice.toString(),
                currency: (0, utils_1.toBuffer)(orderParams.askCurrency),
                currency_price: orderParams.askPrice.toString(),
                currency_value: orderParams.askPrice.toString(),
                needs_conversion: null,
                quantity_remaining: "1",
                valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
                nonce: null,
                source_id_int: source === null || source === void 0 ? void 0 : source.id,
                is_reservoir: null,
                contract: (0, utils_1.toBuffer)(contract),
                conduit: (0, utils_1.toBuffer)(orderParams.side === "sell"
                    ? Sdk.Zora.Addresses.Erc721TransferHelper[index_1.config.chainId]
                    : Sdk.Zora.Addresses.Erc20TransferHelper[index_1.config.chainId]),
                fee_bps: 0,
                fee_breakdown: [],
                dynamic: null,
                raw_data: orderParams,
                expiration: validTo,
            });
            const unfillable = fillabilityStatus !== "fillable" || approvalStatus !== "approved" ? true : undefined;
            results.push({
                id,
                txHash: orderParams.txHash,
                status: "success",
                unfillable,
            });
        }
        catch (error) {
            logger_1.logger.error("orders-zora-v3-save", `Failed to handle order with params ${JSON.stringify(orderParams)}: ${error}`);
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
            { name: "valid_between", mod: ":raw" },
            "nonce",
            "source_id_int",
            "is_reservoir",
            "contract",
            "conduit",
            "fee_bps",
            { name: "fee_breakdown", mod: ":json" },
            "dynamic",
            "raw_data",
            { name: "expiration", mod: ":raw" },
        ], {
            table: "orders",
        });
        await db_1.idb.none(db_1.pgp.helpers.insert(orderValues, columns) + " ON CONFLICT DO NOTHING");
        await ordersUpdateById.addToQueue(results
            .filter((r) => r.status === "success" && !r.unfillable)
            .map(({ id, txHash }) => ({
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