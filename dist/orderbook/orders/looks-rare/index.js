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
const constants_1 = require("@ethersproject/constants");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const p_limit_1 = __importDefault(require("p-limit"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const arweaveRelay = __importStar(require("@/jobs/arweave-relay"));
const ordersUpdateById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const utils_2 = require("@/orderbook/orders/utils");
const check_1 = require("@/orderbook/orders/looks-rare/check");
const commonHelpers = __importStar(require("@/orderbook/orders/common/helpers"));
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const sources_1 = require("@/models/sources");
const save = async (orderInfos, relayToArweave) => {
    const results = [];
    const orderValues = [];
    const arweaveData = [];
    const handleOrder = async ({ orderParams, metadata }) => {
        var _a;
        try {
            const order = new Sdk.LooksRare.Order(index_1.config.chainId, orderParams);
            const id = order.hash();
            // Check: order doesn't already exist
            const orderExists = await db_1.idb.oneOrNone(`SELECT 1 FROM "orders" "o" WHERE "o"."id" = $/id/`, {
                id,
            });
            if (orderExists) {
                return results.push({
                    id,
                    status: "already-exists",
                });
            }
            const currentTime = (0, utils_1.now)();
            // Check: order has a valid listing time
            const listingTime = order.params.startTime;
            if (listingTime - 5 * 60 >= currentTime) {
                // TODO: Add support for not-yet-valid orders
                return results.push({
                    id,
                    status: "invalid-listing-time",
                });
            }
            // Check: order is not expired
            const expirationTime = order.params.endTime;
            if (currentTime >= expirationTime) {
                return results.push({
                    id,
                    status: "expired",
                });
            }
            // Check: order has Weth as payment token
            if (order.params.currency !== Sdk.Common.Addresses.Weth[index_1.config.chainId]) {
                return results.push({
                    id,
                    status: "unsupported-payment-token",
                });
            }
            // Check: order is valid
            try {
                order.checkValidity();
            }
            catch {
                return results.push({
                    id,
                    status: "invalid",
                });
            }
            // Check: order has a valid signature
            try {
                order.checkSignature();
            }
            catch {
                return results.push({
                    id,
                    status: "invalid-signature",
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
                case "contract-wide": {
                    [{ id: tokenSetId }] = await tokenSet.contractWide.save([
                        {
                            id: `contract:${order.params.collection}`,
                            schemaHash,
                            contract: order.params.collection,
                        },
                    ]);
                    break;
                }
                case "single-token": {
                    [{ id: tokenSetId }] = await tokenSet.singleToken.save([
                        {
                            id: `token:${order.params.collection}:${order.params.tokenId}`,
                            schemaHash,
                            contract: order.params.collection,
                            tokenId: order.params.tokenId,
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
            const side = order.params.isOrderAsk ? "sell" : "buy";
            // Handle: currency
            let currency = order.params.currency;
            if (side === "sell" && currency === Sdk.Common.Addresses.Weth[index_1.config.chainId]) {
                // LooksRare sell orders are always in WETH (although fillable in ETH)
                currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
            }
            // Handle: fees
            let feeBreakdown = [
                {
                    kind: "marketplace",
                    recipient: "0x5924a28caaf1cc016617874a2f0c3710d881f3c1",
                    bps: 200,
                },
            ];
            // Handle: royalties
            const royalties = await commonHelpers.getRoyalties(order.params.collection);
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
            const price = order.params.price;
            let value;
            if (side === "buy") {
                // For buy orders, we set the value as `price - fee` since it
                // is best for UX to show the user exactly what they're going
                // to receive on offer acceptance.
                value = (0, utils_1.bn)(price)
                    .sub((0, utils_1.bn)(price).mul((0, utils_1.bn)(feeBps)).div(10000))
                    .toString();
            }
            else {
                // For sell orders, the value is the same as the price
                value = price;
            }
            // Handle: source
            const sources = await sources_1.Sources.getInstance();
            let source = await sources.getOrInsert("looksrare.org");
            if (metadata.source) {
                source = await sources.getOrInsert(metadata.source);
            }
            // Handle: native Reservoir orders
            const isReservoir = false;
            // Handle: conduit
            let conduit = Sdk.LooksRare.Addresses.Exchange[index_1.config.chainId];
            if (side === "sell") {
                const contractKind = await commonHelpers.getContractKind(order.params.collection);
                conduit =
                    contractKind === "erc721"
                        ? Sdk.LooksRare.Addresses.TransferManagerErc721[index_1.config.chainId]
                        : Sdk.LooksRare.Addresses.TransferManagerErc1155[index_1.config.chainId];
            }
            const validFrom = `date_trunc('seconds', to_timestamp(${order.params.startTime}))`;
            const validTo = `date_trunc('seconds', to_timestamp(${order.params.endTime}))`;
            orderValues.push({
                id,
                kind: "looks-rare",
                side,
                fillability_status: fillabilityStatus,
                approval_status: approvalStatus,
                token_set_id: tokenSetId,
                token_set_schema_hash: (0, utils_1.toBuffer)(schemaHash),
                maker: (0, utils_1.toBuffer)(order.params.signer),
                taker: (0, utils_1.toBuffer)(constants_1.AddressZero),
                price,
                value,
                currency: (0, utils_1.toBuffer)(currency),
                currency_price: price,
                currency_value: value,
                needs_conversion: null,
                valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
                nonce: order.params.nonce,
                source_id_int: source === null || source === void 0 ? void 0 : source.id,
                is_reservoir: isReservoir ? isReservoir : null,
                contract: (0, utils_1.toBuffer)(order.params.collection),
                conduit: (0, utils_1.toBuffer)(conduit),
                fee_bps: feeBps,
                fee_breakdown: feeBreakdown || null,
                dynamic: null,
                raw_data: order.params,
                expiration: validTo,
            });
            const unfillable = fillabilityStatus !== "fillable" || approvalStatus !== "approved" ? true : undefined;
            results.push({
                id,
                status: "success",
                unfillable,
            });
            if (relayToArweave) {
                arweaveData.push({ order, schemaHash, source: source === null || source === void 0 ? void 0 : source.domain });
            }
        }
        catch (error) {
            logger_1.logger.error("orders-looks-rare-save", `Failed to handle order with params ${JSON.stringify(orderParams)}: ${error}`);
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
            .map(({ id }) => ({
            context: `new-order-${id}`,
            id,
            trigger: {
                kind: "new-order",
            },
        })));
        if (relayToArweave) {
            await arweaveRelay.addPendingOrdersLooksRare(arweaveData);
        }
    }
    return results;
};
exports.save = save;
//# sourceMappingURL=index.js.map