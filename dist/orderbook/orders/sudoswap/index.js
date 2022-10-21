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
const abi_1 = require("@ethersproject/abi");
const constants_1 = require("@ethersproject/constants");
const contracts_1 = require("@ethersproject/contracts");
const solidity_1 = require("@ethersproject/solidity");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const p_limit_1 = __importDefault(require("p-limit"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const ordersUpdateById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const sources_1 = require("@/models/sources");
const sudoswap_pools_1 = require("@/models/sudoswap-pools");
const utils_2 = require("@/orderbook/orders/utils");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const royalties = __importStar(require("@/utils/royalties"));
const sudoswap = __importStar(require("@/utils/sudoswap"));
const getOrderId = (pool, side) => (0, solidity_1.keccak256)(["string", "address", "string"], ["sudoswap", pool, side]);
exports.getOrderId = getOrderId;
const save = async (orderInfos) => {
    const results = [];
    const orderValues = [];
    const handleOrder = async ({ orderParams }) => {
        try {
            const pool = await sudoswap.getPoolDetails(orderParams.pool);
            if (!pool) {
                throw new Error("Could not fetch pool details");
            }
            const poolContract = new contracts_1.Contract(pool.address, new abi_1.Interface([
                `
            function getSellNFTQuote(uint256 numNFTs) view returns (
                uint8 error,
                uint256 newSpotPrice,
                uint256 newDelta,
                uint256 outputAmount,
                uint256 protocolFee
            )
          `,
            ]), provider_1.baseProvider);
            if ([sudoswap_pools_1.SudoswapPoolKind.TOKEN, sudoswap_pools_1.SudoswapPoolKind.TRADE].includes(pool.poolKind) &&
                pool.token === Sdk.Common.Addresses.Eth[index_1.config.chainId]) {
                const tokenBalance = await provider_1.baseProvider.getBalance(pool.address);
                // TODO: Simulate bonding curve math for improved efficiency
                const prices = [(0, utils_1.bn)(0)];
                let totalPrice = (0, utils_1.bn)(0);
                // For now, we get at most 10 prices (ideally we use off-chain simulation or multicall)
                let i = 0;
                while (i < 10) {
                    const result = await poolContract.getSellNFTQuote(prices.length);
                    if (result.error !== 0 || result.outputAmount.gt(tokenBalance)) {
                        break;
                    }
                    prices.push(result.outputAmount.sub(totalPrice));
                    totalPrice = totalPrice.add(prices[prices.length - 1]);
                    i++;
                }
                // We can only have a single currently active order per pool and side
                const id = (0, exports.getOrderId)(orderParams.pool, "buy");
                if (prices.length > 1) {
                    // Handle: fees
                    let feeBps = 50;
                    const feeBreakdown = [
                        {
                            kind: "marketplace",
                            recipient: "0x4e2f98c96e2d595a83afa35888c4af58ac343e44",
                            bps: 50,
                        },
                    ];
                    const registryRoyalties = await royalties.registry.refreshRegistryRoyalties(pool.nft);
                    for (const { recipient, bps } of registryRoyalties) {
                        feeBps += bps;
                        feeBreakdown.push({
                            kind: "royalty",
                            recipient,
                            bps,
                        });
                    }
                    // Add the protocol fee to the price
                    const price = prices[1].add(prices[1].mul(50).div(10000)).toString();
                    // Subtract the royalties from the price
                    const value = prices[1].sub(prices[1].mul(feeBps - 50).div(10000)).toString();
                    const sdkOrder = new Sdk.Sudoswap.Order(index_1.config.chainId, {
                        pair: orderParams.pool,
                        price: value.toString(),
                    });
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    sdkOrder.params.extra = {
                        values: prices
                            .slice(1)
                            .map((p) => p.mul(feeBps - 50).div(10000))
                            .map(String),
                    };
                    const orderResult = await db_1.redb.oneOrNone(`
              SELECT 1 FROM orders
              WHERE orders.id = $/id/
            `, { id });
                    if (!orderResult) {
                        // Handle: token set
                        const schemaHash = (0, utils_2.generateSchemaHash)();
                        const [{ id: tokenSetId }] = await tokenSet.contractWide.save([
                            {
                                id: `contract:${pool.nft}`,
                                schemaHash,
                                contract: pool.nft,
                            },
                        ]);
                        if (!tokenSetId) {
                            throw new Error("No token set available");
                        }
                        // Handle: source
                        const sources = await sources_1.Sources.getInstance();
                        const source = await sources.getOrInsert("sudoswap.xyz");
                        const validFrom = `date_trunc('seconds', to_timestamp(${orderParams.txTimestamp}))`;
                        const validTo = `'Infinity'`;
                        orderValues.push({
                            id,
                            kind: "sudoswap",
                            side: "buy",
                            fillability_status: "fillable",
                            approval_status: "approved",
                            token_set_id: tokenSetId,
                            token_set_schema_hash: (0, utils_1.toBuffer)(schemaHash),
                            maker: (0, utils_1.toBuffer)(pool.address),
                            taker: (0, utils_1.toBuffer)(constants_1.AddressZero),
                            price,
                            value,
                            currency: (0, utils_1.toBuffer)(pool.token),
                            currency_price: price,
                            currency_value: value,
                            needs_conversion: null,
                            quantity_remaining: (prices.length - 1).toString(),
                            valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
                            nonce: null,
                            source_id_int: source === null || source === void 0 ? void 0 : source.id,
                            is_reservoir: null,
                            contract: (0, utils_1.toBuffer)(pool.nft),
                            conduit: null,
                            fee_bps: feeBps,
                            fee_breakdown: feeBreakdown,
                            dynamic: null,
                            raw_data: sdkOrder.params,
                            expiration: validTo,
                        });
                        return results.push({
                            id,
                            txHash: orderParams.txHash,
                            status: "success",
                        });
                    }
                    else {
                        await db_1.idb.none(`
                UPDATE orders SET
                  fillability_status = 'fillable',
                  price = $/price/,
                  currency_price = $/price/,
                  value = $/value/,
                  currency_value = $/value/,
                  valid_between = tstzrange(date_trunc('seconds', to_timestamp(${orderParams.txTimestamp})), 'Infinity', '[]'),
                  expiration = 'Infinity',
                  updated_at = now(),
                  raw_data = $/rawData:json/
                WHERE orders.id = $/id/
              `, {
                            price,
                            value,
                            rawData: sdkOrder.params,
                            id,
                        });
                        return results.push({
                            id,
                            txHash: orderParams.txHash,
                            status: "success",
                        });
                    }
                }
                else {
                    await db_1.idb.none(`
              UPDATE orders SET
                fillability_status = 'no-balance',
                expiration = to_timestamp(${orderParams.txTimestamp}),
                updated_at = now()
              WHERE orders.id = $/id/
            `, { id });
                    return results.push({
                        id,
                        txHash: orderParams.txHash,
                        status: "success",
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.error("orders-sudoswap-save", `Failed to handle order with params ${JSON.stringify(orderParams)}: ${error}`);
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