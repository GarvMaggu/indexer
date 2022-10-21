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
const check_1 = require("@/orderbook/orders/universe/check");
const commonHelpers = __importStar(require("@/orderbook/orders/common/helpers"));
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const sources_1 = require("@/models/sources");
const provider_1 = require("@/common/provider");
const save = async (orderInfos, relayToArweave) => {
    const results = [];
    const orderValues = [];
    const arweaveData = [];
    const handleOrder = async ({ orderParams, metadata }) => {
        var _a;
        try {
            const order = new Sdk.Universe.Order(index_1.config.chainId, orderParams);
            const exchange = new Sdk.Universe.Exchange(index_1.config.chainId);
            const id = order.hashOrderKey();
            const { side } = order.getInfo();
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
            const listingTime = order.params.start;
            if (listingTime - 5 * 60 >= currentTime) {
                // TODO: Think about the case where we allow not yet valid order in our Marketplace Backend
                // TODO: Add support for not-yet-valid orders
                return results.push({
                    id,
                    status: "invalid-listing-time",
                });
            }
            // Check: order is not expired
            const expirationTime = order.params.end;
            if (currentTime >= expirationTime) {
                return results.push({
                    id,
                    status: "expired",
                });
            }
            const collection = side === "buy"
                ? order.params.take.assetType.contract
                : order.params.make.assetType.contract;
            const tokenId = side === "buy"
                ? order.params.take.assetType.tokenId
                : order.params.make.assetType.tokenId;
            // Handle: currency
            let currency = "";
            if (side === "sell") {
                switch (order.params.take.assetType.assetClass) {
                    case "ETH":
                        currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
                        break;
                    case "ERC20":
                        currency = order.params.take.assetType.contract;
                        break;
                    default:
                        break;
                }
            }
            else {
                // This will always be WETH for now
                currency = order.params.make.assetType.contract;
            }
            // Check: order has Weth or Eth as payment token
            switch (side) {
                // Buy Order
                case "buy":
                    if (currency !== Sdk.Common.Addresses.Weth[index_1.config.chainId]) {
                        return results.push({
                            id,
                            status: "unsupported-payment-token",
                        });
                    }
                    break;
                // Sell order
                case "sell":
                    // We allow ETH and ERC20 orders so no need to validate here
                    break;
                default:
                    return results.push({
                        id,
                        status: "invalid-side",
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
                case "single-token": {
                    [{ id: tokenSetId }] = await tokenSet.singleToken.save([
                        {
                            id: `token:${collection}:${tokenId}`,
                            schemaHash,
                            contract: collection,
                            tokenId: tokenId,
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
            // TODO: Handle: nft royalties
            const nftRoyalties = [];
            // Handle: collection royalties
            const collectionRoyalties = await commonHelpers.getRoyalties(collection);
            let feeBreakdown = collectionRoyalties.map(({ bps, recipient }) => ({
                kind: "royalty",
                recipient,
                bps,
            }));
            // Handle: marketplace fees
            const daoFee = await exchange.getDaoFee(provider_1.baseProvider);
            const daoAddress = await exchange.getFeeReceiver(provider_1.baseProvider);
            feeBreakdown = [
                ...feeBreakdown,
                {
                    kind: "marketplace",
                    recipient: daoAddress,
                    bps: Number(daoFee.toString()),
                },
            ];
            // Handle: order revenueSplits
            const revenueSplits = (order.params.data.revenueSplits || []).map((split) => ({
                kind: "royalty",
                recipient: split.account,
                bps: Number(split.value),
            }));
            feeBreakdown = [...feeBreakdown, ...revenueSplits];
            const feeBps = feeBreakdown.map(({ bps }) => bps).reduce((a, b) => Number(a) + Number(b), 0);
            // Handle: price and value
            const price = side === "buy" ? order.params.make.value : order.params.take.value;
            // For sell orders, the value is the same as the price
            let value = price;
            if (side === "buy") {
                // For buy orders, we set the value as `price - fee` since it
                // is best for UX to show the user exactly what they're going
                // to receive on offer acceptance.
                const nftFeeBps = nftRoyalties
                    .map(({ bps }) => bps)
                    .reduce((a, b) => Number(a) + Number(b), 0);
                const collectionFeeBps = collectionRoyalties
                    .map(({ bps }) => bps)
                    .reduce((a, b) => Number(a) + Number(b), 0);
                const daoFeeBps = Number(daoFee.toString());
                const revenueSplitFeeBps = revenueSplits
                    .map(({ bps }) => bps)
                    .reduce((a, b) => Number(a) + Number(b), 0);
                if (nftFeeBps) {
                    value = (0, utils_1.bn)(value)
                        .sub((0, utils_1.bn)(value).mul((0, utils_1.bn)(nftFeeBps)).div(10000))
                        .toString();
                }
                if (collectionFeeBps) {
                    value = (0, utils_1.bn)(value)
                        .sub((0, utils_1.bn)(value).mul((0, utils_1.bn)(collectionFeeBps)).div(10000))
                        .toString();
                }
                if (daoFeeBps) {
                    value = (0, utils_1.bn)(value)
                        .sub((0, utils_1.bn)(price).mul((0, utils_1.bn)(daoFeeBps)).div(10000))
                        .toString();
                }
                if (revenueSplitFeeBps) {
                    value = (0, utils_1.bn)(value)
                        .sub((0, utils_1.bn)(price).mul((0, utils_1.bn)(revenueSplitFeeBps)).div(10000))
                        .toString();
                }
            }
            // Handle: source
            const sources = await sources_1.Sources.getInstance();
            let source = await sources.getOrInsert("universe.xyz");
            if (metadata.source) {
                source = await sources.getOrInsert(metadata.source);
            }
            // Handle: native Reservoir orders
            const isReservoir = false;
            // Handle: conduit
            const conduit = Sdk.Universe.Addresses.Exchange[index_1.config.chainId];
            const validFrom = `date_trunc('seconds', to_timestamp(${order.params.start}))`;
            const validTo = `date_trunc('seconds', to_timestamp(${order.params.end}))`;
            orderValues.push({
                id,
                kind: "universe",
                side,
                fillability_status: fillabilityStatus,
                approval_status: approvalStatus,
                token_set_id: tokenSetId,
                token_set_schema_hash: (0, utils_1.toBuffer)(schemaHash),
                maker: (0, utils_1.toBuffer)(order.params.maker),
                taker: (0, utils_1.toBuffer)(constants_1.AddressZero),
                price,
                value,
                currency: (0, utils_1.toBuffer)(currency),
                currency_price: price,
                currency_value: value,
                needs_conversion: null,
                valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
                nonce: order.params.salt,
                source_id_int: source === null || source === void 0 ? void 0 : source.id,
                is_reservoir: isReservoir ? isReservoir : null,
                contract: (0, utils_1.toBuffer)(collection),
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
            logger_1.logger.error("orders-universe-save", `Failed to handle order with params ${JSON.stringify(orderParams)}: ${error}`);
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
            await arweaveRelay.addPendingOrdersUniverse(arweaveData);
        }
    }
    return results;
};
exports.save = save;
//# sourceMappingURL=index.js.map