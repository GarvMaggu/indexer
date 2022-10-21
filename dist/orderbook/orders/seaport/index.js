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
exports.getCollectionFloorAskValue = exports.handleTokenList = exports.save = void 0;
const constants_1 = require("@ethersproject/constants");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const p_limit_1 = __importDefault(require("p-limit"));
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const arweaveRelay = __importStar(require("@/jobs/arweave-relay"));
const flagStatusProcessQueue = __importStar(require("@/jobs/flag-status/process-queue"));
const ordersUpdateById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const utils_2 = require("@/orderbook/orders/utils");
const check_1 = require("@/orderbook/orders/seaport/check");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const sources_1 = require("@/models/sources");
const prices_1 = require("@/utils/prices");
const pending_flag_status_sync_jobs_1 = require("@/models/pending-flag-status-sync-jobs");
const redis_1 = require("@/common/redis");
const network_1 = require("@/config/network");
const collections_1 = require("@/models/collections");
const save = async (orderInfos, relayToArweave, validateBidValue) => {
    const results = [];
    const orderValues = [];
    const arweaveData = [];
    const handleOrder = async ({ orderParams, isReservoir, metadata }) => {
        var _a, _b, _c;
        try {
            const order = new Sdk.Seaport.Order(index_1.config.chainId, orderParams);
            const info = order.getInfo();
            const id = order.hash();
            // Check: order has a valid format
            if (!info) {
                return results.push({
                    id,
                    status: "invalid-format",
                });
            }
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
            // Check: order has a non-zero price
            if ((0, utils_1.bn)(info.price).lte(0)) {
                return results.push({
                    id,
                    status: "zero-price",
                });
            }
            const currentTime = (0, utils_1.now)();
            // Check: order has a valid start time
            const startTime = order.params.startTime;
            if (startTime - 5 * 60 >= currentTime) {
                // TODO: Add support for not-yet-valid orders
                return results.push({
                    id,
                    status: "invalid-start-time",
                });
            }
            // Check: order is not expired
            const endTime = order.params.endTime;
            if (currentTime >= endTime) {
                return results.push({
                    id,
                    status: "expired",
                });
            }
            // Check: buy order has Weth as payment token
            if (info.side === "buy" && info.paymentToken !== Sdk.Common.Addresses.Weth[index_1.config.chainId]) {
                return results.push({
                    id,
                    status: "unsupported-payment-token",
                });
            }
            // Check: order has a known zone
            if (![
                // No zone
                constants_1.AddressZero,
                // Pausable zone
                Sdk.Seaport.Addresses.PausableZone[index_1.config.chainId],
            ].includes(order.params.zone)) {
                return results.push({
                    id,
                    status: "unsupported-zone",
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
            const schemaHash = (_a = metadata.schemaHash) !== null && _a !== void 0 ? _a : (0, utils_2.generateSchemaHash)(metadata.schema);
            let tokenSetId;
            switch (order.params.kind) {
                case "single-token": {
                    const typedInfo = info;
                    const tokenId = typedInfo.tokenId;
                    tokenSetId = `token:${info.contract}:${tokenId}`;
                    if (tokenId) {
                        await tokenSet.singleToken.save([
                            {
                                id: tokenSetId,
                                schemaHash,
                                contract: info.contract,
                                tokenId,
                            },
                        ]);
                    }
                    break;
                }
                case "contract-wide": {
                    tokenSetId = `contract:${info.contract}`;
                    await tokenSet.contractWide.save([
                        {
                            id: tokenSetId,
                            schemaHash,
                            contract: info.contract,
                        },
                    ]);
                    break;
                }
                case "token-list": {
                    const typedInfo = info;
                    const merkleRoot = typedInfo.merkleRoot;
                    if (merkleRoot) {
                        tokenSetId = `list:${info.contract}:${(0, utils_1.bn)(merkleRoot).toHexString()}`;
                        await tokenSet.tokenList.save([
                            {
                                id: tokenSetId,
                                schemaHash,
                                schema: metadata.schema,
                            },
                        ]);
                        if (!isReservoir) {
                            await (0, exports.handleTokenList)(id, info.contract, tokenSetId, merkleRoot);
                        }
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
            let feeAmount = order.getFeeAmount();
            // Handle: price and value
            let price = (0, utils_1.bn)(order.getMatchingPrice());
            let value = price;
            if (info.side === "buy") {
                // For buy orders, we set the value as `price - fee` since it
                // is best for UX to show the user exactly what they're going
                // to receive on offer acceptance.
                value = (0, utils_1.bn)(price).sub(feeAmount);
            }
            // The price, value and fee are for a single item
            if ((0, utils_1.bn)(info.amount).gt(1)) {
                price = price.div(info.amount);
                value = value.div(info.amount);
                feeAmount = feeAmount.div(info.amount);
            }
            const feeBps = price.eq(0) ? (0, utils_1.bn)(0) : feeAmount.mul(10000).div(price);
            if (feeBps.gt(10000)) {
                return results.push({
                    id,
                    status: "fees-too-high",
                });
            }
            // // Handle: fee breakdown
            const openSeaFeeRecipients = [
                "0x5b3256965e7c3cf26e11fcaf296dfc8807c01073",
                "0x8de9c5a032463c561423387a9648c5c7bcc5bc90",
                "0x0000a26b00c1f0df003000390027140000faa719",
            ];
            const royaltyRecipients = [];
            const collectionRoyalties = await db_1.redb.oneOrNone(`SELECT royalties FROM collections WHERE id = $/id/`, { id: info.contract });
            if (collectionRoyalties) {
                for (const royalty of collectionRoyalties.royalties) {
                    royaltyRecipients.push(royalty.recipient);
                }
            }
            const feeBreakdown = info.fees.map(({ recipient, amount }) => ({
                kind: royaltyRecipients.includes(recipient.toLowerCase()) ? "royalty" : "marketplace",
                recipient,
                bps: price.eq(0) ? 0 : (0, utils_1.bn)(amount).mul(10000).div(price).toNumber(),
            }));
            // Handle: source
            const sources = await sources_1.Sources.getInstance();
            let source = await sources.getOrInsert("opensea.io");
            // If the order is native, override any default source
            if (isReservoir) {
                if (metadata.source) {
                    // If we can detect the marketplace (only OpenSea for now) do not override
                    if (lodash_1.default.isEmpty(lodash_1.default.intersection(feeBreakdown.map(({ recipient }) => recipient), openSeaFeeRecipients))) {
                        source = await sources.getOrInsert(metadata.source);
                    }
                }
                else {
                    source = undefined;
                }
            }
            // Handle: price conversion
            const currency = info.paymentToken;
            const currencyPrice = price.toString();
            const currencyValue = value.toString();
            let needsConversion = false;
            if (![
                Sdk.Common.Addresses.Eth[index_1.config.chainId],
                Sdk.Common.Addresses.Weth[index_1.config.chainId],
            ].includes(currency)) {
                needsConversion = true;
                // If the currency is anything other than ETH/WETH, we convert
                // `price` and `value` from that currency denominations to the
                // ETH denomination
                {
                    const prices = await (0, prices_1.getUSDAndNativePrices)(currency, price.toString(), currentTime);
                    if (!prices.nativePrice) {
                        // Getting the native price is a must
                        return results.push({
                            id,
                            status: "failed-to-convert-price",
                        });
                    }
                    price = (0, utils_1.bn)(prices.nativePrice);
                }
                {
                    const prices = await (0, prices_1.getUSDAndNativePrices)(currency, value.toString(), currentTime);
                    if (!prices.nativePrice) {
                        // Getting the native price is a must
                        return results.push({
                            id,
                            status: "failed-to-convert-price",
                        });
                    }
                    value = (0, utils_1.bn)(prices.nativePrice);
                }
            }
            if (info.side === "buy" && order.params.kind === "single-token" && validateBidValue) {
                const typedInfo = info;
                const tokenId = typedInfo.tokenId;
                const seaportBidPercentageThreshold = 90;
                try {
                    const collectionFloorAskValue = await (0, exports.getCollectionFloorAskValue)(info.contract, Number(tokenId));
                    if (collectionFloorAskValue) {
                        const percentage = (Number(value.toString()) / collectionFloorAskValue) * 100;
                        if (percentage < seaportBidPercentageThreshold) {
                            return results.push({
                                id,
                                status: "bid-too-low",
                            });
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.error("orders-seaport-save", `Bid value validation - error. orderId=${id}, contract=${info.contract}, tokenId=${tokenId}, error=${error}`);
                }
            }
            const validFrom = `date_trunc('seconds', to_timestamp(${startTime}))`;
            const validTo = endTime
                ? `date_trunc('seconds', to_timestamp(${order.params.endTime}))`
                : "'infinity'";
            orderValues.push({
                id,
                kind: "seaport",
                side: info.side,
                fillability_status: fillabilityStatus,
                approval_status: approvalStatus,
                token_set_id: tokenSetId,
                token_set_schema_hash: (0, utils_1.toBuffer)(schemaHash),
                offer_bundle_id: null,
                consideration_bundle_id: null,
                bundle_kind: null,
                maker: (0, utils_1.toBuffer)(order.params.offerer),
                taker: (0, utils_1.toBuffer)(info.taker),
                price: price.toString(),
                value: value.toString(),
                currency: (0, utils_1.toBuffer)(info.paymentToken),
                currency_price: currencyPrice.toString(),
                currency_value: currencyValue.toString(),
                needs_conversion: needsConversion,
                quantity_remaining: (_b = info.amount) !== null && _b !== void 0 ? _b : "1",
                valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
                nonce: order.params.counter,
                source_id_int: source === null || source === void 0 ? void 0 : source.id,
                is_reservoir: isReservoir ? isReservoir : null,
                contract: (0, utils_1.toBuffer)(info.contract),
                conduit: (0, utils_1.toBuffer)(new Sdk.Seaport.Exchange(index_1.config.chainId).deriveConduit(order.params.conduitKey)),
                fee_bps: feeBps.toNumber(),
                fee_breakdown: feeBreakdown || null,
                dynamic: (_c = info.isDynamic) !== null && _c !== void 0 ? _c : null,
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
            logger_1.logger.warn("orders-seaport-save", `Failed to handle order with params ${JSON.stringify(orderParams)}: ${error} (will retry)`);
            // Throw so that we retry with he bundle-handling code
            throw error;
        }
    };
    // const handleBundleOrder = async ({ orderParams, isReservoir, metadata }: OrderInfo) => {
    //   try {
    //     const order = new Sdk.Seaport.BundleOrder(config.chainId, orderParams);
    //     const info = order.getInfo();
    //     const id = order.hash();
    //     // Check: order has a valid format
    //     if (!info) {
    //       return results.push({
    //         id,
    //         status: "invalid-format",
    //       });
    //     }
    //     // Check: order doesn't already exist
    //     const orderExists = await idb.oneOrNone(`SELECT 1 FROM orders WHERE orders.id = $/id/`, {
    //       id,
    //     });
    //     if (orderExists) {
    //       return results.push({
    //         id,
    //         status: "already-exists",
    //       });
    //     }
    //     const currentTime = now();
    //     // Check: order has a valid start time
    //     const startTime = order.params.startTime;
    //     if (startTime - 5 * 60 >= currentTime) {
    //       // TODO: Add support for not-yet-valid orders
    //       return results.push({
    //         id,
    //         status: "invalid-start-time",
    //       });
    //     }
    //     // Check: order is not expired
    //     const endTime = order.params.endTime;
    //     if (currentTime >= endTime) {
    //       return results.push({
    //         id,
    //         status: "expired",
    //       });
    //     }
    //     // Check: order has a known zone
    //     if (
    //       ![
    //         // No zone
    //         AddressZero,
    //         // Are these really used?
    //         "0xf397619df7bfd4d1657ea9bdd9df7ff888731a11",
    //         "0x9b814233894cd227f561b78cc65891aa55c62ad2",
    //         // Pausable zone
    //         Sdk.Seaport.Addresses.PausableZone[config.chainId],
    //       ].includes(order.params.zone)
    //     ) {
    //       return results.push({
    //         id,
    //         status: "unsupported-zone",
    //       });
    //     }
    //     // Check: order is valid
    //     try {
    //       order.checkValidity();
    //     } catch {
    //       return results.push({
    //         id,
    //         status: "invalid",
    //       });
    //     }
    //     // Check: order has a valid signature
    //     try {
    //       order.checkSignature();
    //     } catch (error) {
    //       return results.push({
    //         id,
    //         status: "invalid-signature",
    //       });
    //     }
    //     // Check: order fillability
    //     let fillabilityStatus = "fillable";
    //     let approvalStatus = "approved";
    //     try {
    //       await offChainCheckBundle(order, { onChainApprovalRecheck: true });
    //       // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //     } catch (error: any) {
    //       // Keep any orders that can potentially get valid in the future
    //       if (error.message === "no-balance-no-approval") {
    //         fillabilityStatus = "no-balance";
    //         approvalStatus = "no-approval";
    //       } else if (error.message === "no-approval") {
    //         approvalStatus = "no-approval";
    //       } else if (error.message === "no-balance") {
    //         fillabilityStatus = "no-balance";
    //       } else {
    //         return results.push({
    //           id,
    //           status: "not-fillable",
    //         });
    //       }
    //     }
    //     // TODO: Add support for non-token token sets
    //     const tokenSets = await tokenSet.singleToken.save(
    //       info.offerItems.map((item) => ({
    //         id: `token:${item.contract}:${item.tokenId!}`,
    //         schemaHash: generateSchemaHash(),
    //         contract: item.contract,
    //         tokenId: item.tokenId!,
    //       }))
    //     );
    //     // TODO: Add support for consideration bundles
    //     const offerBundle = await bundles.create(tokenSets.map(({ id }) => ({ kind: "nft", id })));
    //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //     const currency = (info as any).paymentToken;
    //     if (order.params.kind === "bundle-ask") {
    //       // Check: order has a non-zero price
    //       // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //       if (bn((info as any).price).lte(0)) {
    //         return results.push({
    //           id,
    //           status: "zero-price",
    //         });
    //       }
    //     }
    //     // Handle: price and value
    //     let price = bn(order.getMatchingPrice());
    //     const currencyPrice = price;
    //     let value = price;
    //     // Handle: fees
    //     const feeAmount = order.getFeeAmount();
    //     const feeBps = price.eq(0) ? bn(0) : feeAmount.mul(10000).div(price);
    //     if (feeBps.gt(10000)) {
    //       return results.push({
    //         id,
    //         status: "fees-too-high",
    //       });
    //     }
    //     // Handle: fee breakdown
    //     const openSeaFeeRecipients = [
    //       "0x5b3256965e7c3cf26e11fcaf296dfc8807c01073",
    //       "0x8de9c5a032463c561423387a9648c5c7bcc5bc90",
    //     ];
    //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //     const feeBreakdown = ((info as any) || []).fees.map(
    //       ({ recipient, amount }: { recipient: string; amount: string }) => ({
    //         kind: openSeaFeeRecipients.includes(recipient.toLowerCase()) ? "marketplace" : "royalty",
    //         recipient,
    //         bps: price.eq(0) ? 0 : bn(amount).mul(10000).div(price).toNumber(),
    //       })
    //     );
    //     // Handle: source
    //     const sources = await Sources.getInstance();
    //     let source;
    //     if (metadata.source) {
    //       source = await sources.getOrInsert(metadata.source);
    //     } else {
    //       // If one of the fees is marketplace the source of the order is opensea
    //       for (const fee of feeBreakdown) {
    //         if (fee.kind == "marketplace") {
    //           source = await sources.getOrInsert("opensea.io");
    //           break;
    //         }
    //       }
    //     }
    //     // Handle: price conversion
    //     {
    //       const prices = await getUSDAndNativePrices(
    //         currency,
    //         price.toString(),
    //         currentTime
    //       );
    //       if (!prices.nativePrice) {
    //         // Getting the native price is a must
    //         return results.push({
    //           id,
    //           status: "failed-to-convert-price",
    //         });
    //       }
    //       price = bn(prices.nativePrice);
    //     }
    //     {
    //       const prices = await getUSDAndNativePrices(
    //         currency,
    //         value.toString(),
    //         currentTime
    //       );
    //       if (!prices.nativePrice) {
    //         // Getting the native price is a must
    //         return results.push({
    //           id,
    //           status: "failed-to-convert-price",
    //         });
    //       }
    //       value = bn(prices.nativePrice);
    //     }
    //     const validFrom = `date_trunc('seconds', to_timestamp(${startTime}))`;
    //     const validTo = endTime
    //       ? `date_trunc('seconds', to_timestamp(${order.params.endTime}))`
    //       : "'infinity'";
    //     orderValues.push({
    //       id,
    //       kind: "seaport",
    //       side: "bundle",
    //       fillability_status: fillabilityStatus,
    //       approval_status: approvalStatus,
    //       token_set_id: null,
    //       token_set_schema_hash: null,
    //       offer_bundle_id: offerBundle,
    //       consideration_bundle_id: undefined,
    //       // eslint-disable-next-line @typescript-eslint/no-explicit-any
    //       bundle_kind: order.params.kind as any,
    //       contract: null,
    //       maker: toBuffer(order.params.offerer),
    //       taker: toBuffer(info.taker),
    //       price: price.toString(),
    //       value: value.toString(),
    //       currency: currency ? toBuffer(currency) : undefined,
    //       currency_price: currencyPrice.toString(),
    //       valid_between: `tstzrange(${validFrom}, ${validTo}, '[]')`,
    //       nonce: order.params.counter,
    //       source_id_int: source?.id,
    //       is_reservoir: isReservoir ? isReservoir : null,
    //       conduit: toBuffer(
    //         new Sdk.Seaport.Exchange(config.chainId).deriveConduit(order.params.conduitKey)
    //       ),
    //       fee_breakdown: feeBreakdown,
    //       fee_bps: feeBps.toNumber(),
    //       raw_data: order.params,
    //       dynamic: null,
    //       expiration: validTo,
    //     });
    //     results.push({
    //       id,
    //       status: "success",
    //       unfillable:
    //         fillabilityStatus !== "fillable" || approvalStatus !== "approved" ? true : undefined,
    //     });
    //     if (relayToArweave) {
    //       arweaveData.push({ order, source: source?.domain });
    //     }
    //   } catch (error) {
    //     logger.error(
    //       "orders-seaport-save-bundle",
    //       `Failed to handle bundle order with params ${JSON.stringify(orderParams)}: ${error}`
    //     );
    //   }
    // };
    // Process all orders concurrently
    const limit = (0, p_limit_1.default)(20);
    await Promise.all(orderInfos.map((orderInfo) => limit(async () => handleOrder(orderInfo))));
    if (orderValues.length) {
        const columns = new db_1.pgp.helpers.ColumnSet([
            "id",
            "kind",
            "side",
            "fillability_status",
            "approval_status",
            "token_set_id",
            "token_set_schema_hash",
            "offer_bundle_id",
            "consideration_bundle_id",
            "bundle_kind",
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
            await arweaveRelay.addPendingOrdersSeaport(arweaveData);
        }
    }
    return results;
};
exports.save = save;
const handleTokenList = async (orderId, contract, tokenSetId, merkleRoot) => {
    try {
        const handleTokenSetId = await redis_1.redis.set(`seaport-handle-token-list:${tokenSetId}`, Date.now(), "EX", 86400, "NX");
        if (handleTokenSetId) {
            const collectionDay30Rank = await redis_1.redis.zscore("collections_day30_rank", contract);
            if (!collectionDay30Rank || Number(collectionDay30Rank) <= 1000) {
                const tokenSetTokensExist = await db_1.redb.oneOrNone(`
                  SELECT 1 FROM "token_sets" "ts"
                  WHERE "ts"."id" = $/tokenSetId/
                  LIMIT 1
                `, { tokenSetId });
                if (!tokenSetTokensExist) {
                    logger_1.logger.info("orders-seaport-save", `handleTokenList - Missing TokenSet Check - Missing tokenSet. orderId=${orderId}, contract=${contract}, merkleRoot=${merkleRoot}, tokenSetId=${tokenSetId}, collectionDay30Rank=${collectionDay30Rank}`);
                    const pendingFlagStatusSyncJobs = new pending_flag_status_sync_jobs_1.PendingFlagStatusSyncJobs();
                    if ((0, network_1.getNetworkSettings)().multiCollectionContracts.includes(contract)) {
                        const collectionIds = await db_1.redb.manyOrNone(`
                      SELECT id FROM "collections" "c"
                      WHERE "c"."contract" = $/contract/
                      AND day30_rank <= 1000
                    `, { contract: (0, utils_1.toBuffer)(contract) });
                        await pendingFlagStatusSyncJobs.add(collectionIds.map((c) => ({
                            kind: "collection",
                            data: {
                                collectionId: c.id,
                                backfill: false,
                            },
                        })));
                    }
                    else {
                        await pendingFlagStatusSyncJobs.add([
                            {
                                kind: "collection",
                                data: {
                                    collectionId: contract,
                                    backfill: false,
                                },
                            },
                        ]);
                    }
                    await flagStatusProcessQueue.addToQueue();
                }
            }
        }
    }
    catch (error) {
        logger_1.logger.error("orders-seaport-save", `handleTokenList - Error. orderId=${orderId}, contract=${contract}, merkleRoot=${merkleRoot}, tokenSetId=${tokenSetId}, error=${error}`);
    }
};
exports.handleTokenList = handleTokenList;
const getCollectionFloorAskValue = async (contract, tokenId) => {
    if ((0, network_1.getNetworkSettings)().multiCollectionContracts.includes(contract)) {
        const collection = await collections_1.Collections.getByContractAndTokenId(contract, tokenId);
        return collection === null || collection === void 0 ? void 0 : collection.floorSellValue;
    }
    else {
        const collectionFloorAskValue = await redis_1.redis.get(`collection-floor-ask:${contract}`);
        if (collectionFloorAskValue) {
            return Number(collectionFloorAskValue);
        }
        else {
            const collection = await collections_1.Collections.getByContractAndTokenId(contract, tokenId);
            const collectionFloorAskValue = collection.floorSellValue || 0;
            await redis_1.redis.set(`collection-floor-ask:${contract}`, collectionFloorAskValue, "EX", 3600);
            return collectionFloorAskValue;
        }
    }
};
exports.getCollectionFloorAskValue = getCollectionFloorAskValue;
//# sourceMappingURL=index.js.map