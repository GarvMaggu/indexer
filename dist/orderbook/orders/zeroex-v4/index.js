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
const merkle_1 = require("@reservoir0x/sdk/dist/common/helpers/merkle");
const p_limit_1 = __importDefault(require("p-limit"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const arweaveRelay = __importStar(require("@/jobs/arweave-relay"));
const ordersUpdateById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const commonHelpers = __importStar(require("@/orderbook/orders/common/helpers"));
const utils_2 = require("@/orderbook/orders/utils");
const check_1 = require("@/orderbook/orders/zeroex-v4/check");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const sources_1 = require("@/models/sources");
const save = async (orderInfos, relayToArweave) => {
    const results = [];
    const orderValues = [];
    const arweaveData = [];
    const handleOrder = async ({ orderParams, metadata }) => {
        var _a, _b, _c;
        try {
            const order = new Sdk.ZeroExV4.Order(index_1.config.chainId, orderParams);
            const id = order.hash();
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
            const kind = await commonHelpers.getContractKind(order.params.nft);
            if (!kind) {
                return results.push({
                    id,
                    status: "unknown-order-kind",
                });
            }
            // Check: order has unique nonce
            if (kind === "erc1155") {
                // For erc1155, enforce uniqueness of maker/nonce/contract/price
                const nonceExists = await db_1.idb.oneOrNone(`
            SELECT 1 FROM orders
            WHERE orders.kind = 'zeroex-v4-erc1155'
              AND orders.maker = $/maker/
              AND orders.nonce = $/nonce/
              AND orders.contract = $/contract/
              AND (orders.raw_data ->> 'erc20TokenAmount')::NUMERIC / (orders.raw_data ->> 'nftAmount')::NUMERIC = $/price/
          `, {
                    maker: (0, utils_1.toBuffer)(order.params.maker),
                    nonce: order.params.nonce,
                    contract: (0, utils_1.toBuffer)(order.params.nft),
                    price: (0, utils_1.bn)(order.params.erc20TokenAmount).div(order.params.nftAmount).toString(),
                });
                if (nonceExists) {
                    return results.push({
                        id,
                        status: "duplicated-nonce",
                    });
                }
            }
            else {
                // For erc721, enforce uniqueness of maker/nonce/contract/price
                const nonceExists = await db_1.idb.oneOrNone(`
            SELECT 1 FROM orders
            WHERE orders.kind = 'zeroex-v4-erc721'
              AND orders.maker = $/maker/
              AND orders.nonce = $/nonce/
              AND orders.contract = $/contract/
              AND (orders.raw_data ->> 'erc20TokenAmount')::NUMERIC = $/price/
          `, {
                    maker: (0, utils_1.toBuffer)(order.params.maker),
                    nonce: order.params.nonce,
                    contract: (0, utils_1.toBuffer)(order.params.nft),
                    price: order.params.erc20TokenAmount,
                });
                if (nonceExists) {
                    return results.push({
                        id,
                        status: "duplicated-nonce",
                    });
                }
            }
            const currentTime = (0, utils_1.now)();
            // Check: order is not expired
            const expirationTime = order.params.expiry;
            if (currentTime >= expirationTime) {
                return results.push({
                    id,
                    status: "expired",
                });
            }
            // Check: buy order has Weth as payment token
            if (order.params.direction === Sdk.ZeroExV4.Types.TradeDirection.BUY &&
                order.params.erc20Token !== Sdk.Common.Addresses.Weth[index_1.config.chainId]) {
                return results.push({
                    id,
                    status: "unsupported-payment-token",
                });
            }
            // Check: sell order has Eth as payment token
            if (order.params.direction === Sdk.ZeroExV4.Types.TradeDirection.SELL &&
                order.params.erc20Token !== Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]) {
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
            const info = order.getInfo();
            if (!info) {
                return results.push({
                    id,
                    status: "unknown-info",
                });
            }
            const orderKind = (_b = order.params.kind) === null || _b === void 0 ? void 0 : _b.split("-").slice(1).join("-");
            switch (orderKind) {
                case "contract-wide": {
                    [{ id: tokenSetId }] = await tokenSet.contractWide.save([
                        {
                            id: `contract:${order.params.nft}`,
                            schemaHash,
                            contract: order.params.nft,
                        },
                    ]);
                    break;
                }
                case "single-token": {
                    [{ id: tokenSetId }] = await tokenSet.singleToken.save([
                        {
                            id: `token:${order.params.nft}:${order.params.nftId}`,
                            schemaHash,
                            contract: order.params.nft,
                            tokenId: order.params.nftId,
                        },
                    ]);
                    break;
                }
                case "token-range": {
                    const typedInfo = info;
                    const startTokenId = typedInfo.startTokenId.toString();
                    const endTokenId = typedInfo.endTokenId.toString();
                    if (startTokenId && endTokenId) {
                        [{ id: tokenSetId }] = await tokenSet.tokenRange.save([
                            {
                                id: `range:${order.params.nft}:${startTokenId}:${endTokenId}`,
                                schemaHash,
                                contract: order.params.nft,
                                startTokenId,
                                endTokenId,
                            },
                        ]);
                    }
                    break;
                }
                case "token-list-bit-vector":
                case "token-list-packed-list": {
                    const typedInfo = info;
                    const tokenIds = typedInfo.tokenIds;
                    const merkleRoot = (0, merkle_1.generateMerkleTree)(tokenIds);
                    if (merkleRoot) {
                        [{ id: tokenSetId }] = await tokenSet.tokenList.save([
                            {
                                id: `list:${order.params.nft}:${merkleRoot.getHexRoot()}`,
                                schemaHash,
                                schema: metadata.schema,
                            },
                        ]);
                    }
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
            const feeAmount = order.getFeeAmount();
            const side = order.params.direction === Sdk.ZeroExV4.Types.TradeDirection.BUY ? "buy" : "sell";
            // Handle: price and value
            let price = (0, utils_1.bn)(order.params.erc20TokenAmount).add(feeAmount);
            let value = price;
            if (side === "buy") {
                // For buy orders, we set the value as `price - fee` since it
                // is best for UX to show the user exactly what they're going
                // to receive on offer acceptance.
                value = (0, utils_1.bn)(price).sub(feeAmount);
            }
            // The price and value are for a single item
            if ((_c = order.params.kind) === null || _c === void 0 ? void 0 : _c.startsWith("erc1155")) {
                price = price.div(order.params.nftAmount);
                value = value.div(order.params.nftAmount);
            }
            const feeBps = price.eq(0) ? (0, utils_1.bn)(0) : feeAmount.mul(10000).div(price);
            if (feeBps.gt(10000)) {
                return results.push({
                    id,
                    status: "fees-too-high",
                });
            }
            // Handle: source
            const sources = await sources_1.Sources.getInstance();
            const source = metadata.source ? await sources.getOrInsert(metadata.source) : undefined;
            // Handle: native Reservoir orders
            const isReservoir = true;
            // Handle: fee breakdown
            const feeBreakdown = order.params.fees.map(({ recipient, amount }) => ({
                kind: "royalty",
                recipient,
                bps: price.eq(0) ? (0, utils_1.bn)(0) : (0, utils_1.bn)(amount).mul(10000).div(price).toNumber(),
            }));
            // Handle: currency
            let currency = order.params.erc20Token;
            if (currency === Sdk.ZeroExV4.Addresses.Eth[index_1.config.chainId]) {
                // ZeroEx-like exchanges use a non-standard ETH address
                currency = Sdk.Common.Addresses.Eth[index_1.config.chainId];
            }
            const validFrom = `date_trunc('seconds', to_timestamp(0))`;
            const validTo = `date_trunc('seconds', to_timestamp(${order.params.expiry}))`;
            orderValues.push({
                id,
                kind: `zeroex-v4-${kind}`,
                side,
                fillability_status: fillabilityStatus,
                approval_status: approvalStatus,
                token_set_id: tokenSetId,
                token_set_schema_hash: (0, utils_1.toBuffer)(schemaHash),
                maker: (0, utils_1.toBuffer)(order.params.maker),
                taker: (0, utils_1.toBuffer)(order.params.taker),
                price: price.toString(),
                value: value.toString(),
                currency: (0, utils_1.toBuffer)(currency),
                currency_price: price.toString(),
                currency_value: value.toString(),
                needs_conversion: null,
                quantity_remaining: order.params.nftAmount,
                valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
                nonce: order.params.nonce,
                source_id_int: source === null || source === void 0 ? void 0 : source.id,
                is_reservoir: isReservoir ? isReservoir : null,
                contract: (0, utils_1.toBuffer)(order.params.nft),
                conduit: (0, utils_1.toBuffer)(Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId]),
                fee_bps: feeBps.toNumber(),
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
            logger_1.logger.error("orders-zeroex-v4-save", `Failed to handle order with params ${JSON.stringify(orderParams)}: ${error}`);
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
        if (relayToArweave) {
            await arweaveRelay.addPendingOrdersZeroExV4(arweaveData);
        }
    }
    return results;
};
exports.save = save;
//# sourceMappingURL=index.js.map