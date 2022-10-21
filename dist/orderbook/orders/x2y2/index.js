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
exports.save = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const p_limit_1 = __importDefault(require("p-limit"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const ordersUpdateById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const commonHelpers = __importStar(require("@/orderbook/orders/common/helpers"));
const utils_2 = require("@/orderbook/orders/utils");
const check_1 = require("@/orderbook/orders/x2y2/check");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const sources_1 = require("@/models/sources");
const save = async (orderInfos) => {
    const results = [];
    const orderValues = [];
    // We don't relay X2Y2 orders to Arweave since there is no way to check
    // the validity of those orders in a decentralized way (we fully depend
    // on X2Y2's API for that).
    const successOrders = [];
    const handleOrder = async ({ orderParams, metadata }) => {
        var _a;
        try {
            const order = new Sdk.X2Y2.Order(index_1.config.chainId, orderParams);
            const id = order.params.itemHash;
            // Check: order doesn't already exist
            const orderExists = await db_1.idb.oneOrNone(`SELECT 1 FROM orders WHERE orders.id = $/id/`, {
                id,
            });
            if (orderExists) {
                return results.push({
                    id,
                    status: "already-exists",
                });
            }
            // Handle: get order kind
            const kind = await commonHelpers.getContractKind(order.params.nft.token);
            if (!kind) {
                return results.push({
                    id,
                    status: "unknown-order-kind",
                });
            }
            const currentTime = (0, utils_1.now)();
            // Check: order is not expired
            const expirationTime = order.params.deadline;
            if (currentTime >= expirationTime) {
                return results.push({
                    id,
                    status: "expired",
                });
            }
            // Check: sell order has Eth as payment token
            if (order.params.type === "sell" &&
                order.params.currency !== Sdk.Common.Addresses.Eth[index_1.config.chainId]) {
                return results.push({
                    id,
                    status: "unsupported-payment-token",
                });
            }
            // Check: buy order has Weth as payment token
            if (order.params.type === "buy" &&
                order.params.currency !== Sdk.Common.Addresses.Weth[index_1.config.chainId]) {
                return results.push({
                    id,
                    status: "unsupported-payment-token",
                });
            }
            // Check: order fillability
            let fillabilityStatus = "fillable";
            let approvalStatus = "approved";
            try {
                await (0, check_1.offChainCheck)(order, { onChainApprovalRecheck: true });
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
                        status: "not-fillable",
                    });
                }
            }
            // Check and save: associated token set
            let tokenSetId;
            const schemaHash = (_a = metadata.schemaHash) !== null && _a !== void 0 ? _a : (0, utils_2.generateSchemaHash)(metadata.schema);
            switch (order.params.kind) {
                case "single-token": {
                    [{ id: tokenSetId }] = await tokenSet.singleToken.save([
                        {
                            id: `token:${order.params.nft.token}:${order.params.nft.tokenId}`,
                            schemaHash,
                            contract: order.params.nft.token,
                            tokenId: order.params.nft.tokenId,
                        },
                    ]);
                    break;
                }
                case "collection-wide": {
                    [{ id: tokenSetId }] = await tokenSet.contractWide.save([
                        {
                            id: `contract:${order.params.nft.token}`,
                            schemaHash,
                            contract: order.params.nft.token,
                        },
                    ]);
                    break;
                }
            }
            if (!tokenSetId) {
                return results.push({
                    id,
                    status: "invalid-token-set",
                });
            }
            // Handle: fees
            let feeBreakdown = [
                {
                    kind: "marketplace",
                    recipient: Sdk.X2Y2.Addresses.FeeManager[index_1.config.chainId],
                    bps: 50,
                },
            ];
            // Handle: royalties
            const royalties = await commonHelpers.getRoyalties(order.params.nft.token);
            feeBreakdown = [
                ...feeBreakdown,
                ...royalties.map(({ bps, recipient }) => ({
                    kind: "royalty",
                    recipient,
                    bps,
                })),
            ];
            const feeBps = feeBreakdown.map(({ bps }) => bps).reduce((a, b) => Number(a) + Number(b), 0);
            // Handle: price and value
            const price = (0, utils_1.bn)(order.params.price);
            const value = order.params.type === "sell" ? price : price.sub(price.mul(feeBps).div(10000));
            // Handle: source
            const sources = await sources_1.Sources.getInstance();
            const source = await sources.getOrInsert("x2y2.io");
            // Handle: native Reservoir orders
            const isReservoir = false;
            // Handle: conduit
            let conduit = Sdk.X2Y2.Addresses.Exchange[index_1.config.chainId];
            if (order.params.type === "sell") {
                conduit = Sdk.X2Y2.Addresses.Erc721Delegate[index_1.config.chainId];
            }
            const validFrom = `date_trunc('seconds', to_timestamp(${currentTime}))`;
            const validTo = `date_trunc('seconds', to_timestamp(${order.params.deadline}))`;
            orderValues.push({
                id,
                kind: "x2y2",
                side: order.params.type === "sell" ? "sell" : "buy",
                fillability_status: fillabilityStatus,
                approval_status: approvalStatus,
                token_set_id: tokenSetId,
                token_set_schema_hash: (0, utils_1.toBuffer)(schemaHash),
                maker: (0, utils_1.toBuffer)(order.params.maker),
                taker: (0, utils_1.toBuffer)(order.params.taker),
                price: price.toString(),
                value: value.toString(),
                currency: (0, utils_1.toBuffer)(order.params.currency),
                currency_price: price.toString(),
                currency_value: value.toString(),
                needs_conversion: null,
                quantity_remaining: "1",
                valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
                nonce: null,
                source_id_int: source === null || source === void 0 ? void 0 : source.id,
                is_reservoir: isReservoir ? isReservoir : null,
                contract: (0, utils_1.toBuffer)(order.params.nft.token),
                conduit: (0, utils_1.toBuffer)(conduit),
                fee_bps: feeBps,
                fee_breakdown: feeBreakdown || null,
                dynamic: null,
                raw_data: order.params,
                expiration: validTo,
            });
            results.push({
                id,
                status: "success",
                unfillable: fillabilityStatus !== "fillable" || approvalStatus !== "approved" ? true : undefined,
            });
            if (!results[results.length - 1].unfillable) {
                successOrders.push(orderParams);
            }
        }
        catch (error) {
            logger_1.logger.error("orders-x2y2-save", `Failed to handle order with params ${JSON.stringify(orderParams)}: ${error}`);
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
            .map(({ id }) => ({
            context: `new-order-${id}`,
            id,
            trigger: {
                kind: "new-order",
            },
        })));
        // When lowering the price of a listing, X2Y2 will off-chain cancel
        // all previous orders (they can do that by having their backend to
        // refuse signing on any previous orders).
        // https://discordapp.com/channels/977147775366082560/977189354738962463/987253907430449213
        for (const orderParams of successOrders) {
            if (orderParams.type === "sell") {
                const result = await db_1.idb.manyOrNone(`
            WITH x AS (
              SELECT
                orders.id
              FROM orders
              WHERE orders.kind = 'x2y2'
                AND orders.side = 'sell'
                AND orders.maker = $/maker/
                AND orders.token_set_id = $/tokenSetId/
                AND (orders.fillability_status = 'fillable' OR orders.fillability_status = 'no-balance')
                AND orders.price > $/price/
            )
            UPDATE orders AS o SET
              fillability_status = 'cancelled'
            FROM x
            WHERE o.id = x.id
            RETURNING o.id
          `, {
                    maker: (0, utils_1.toBuffer)(orderParams.maker),
                    tokenSetId: `token:${orderParams.nft.token}:${orderParams.nft.tokenId}`.toLowerCase(),
                    price: orderParams.price,
                });
                await ordersUpdateById.addToQueue(result.map(({ id }) => ({
                    context: `cancelled-${id}`,
                    id,
                    trigger: {
                        kind: "new-order",
                    },
                })));
            }
        }
    }
    return results;
};
exports.save = save;
//# sourceMappingURL=index.js.map