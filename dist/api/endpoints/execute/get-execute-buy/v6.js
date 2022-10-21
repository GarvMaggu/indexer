"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
exports.getExecuteBuyV6Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk-new"));
const joi_1 = __importDefault(require("joi"));
const index_1 = require("@/api/index");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_2 = require("@/config/index");
const api_keys_1 = require("@/models/api-keys");
const sources_1 = require("@/models/sources");
const orders_1 = require("@/orderbook/orders");
const currencies_1 = require("@/utils/currencies");
const version = "v6";
exports.getExecuteBuyV6Options = {
    description: "Buy tokens",
    tags: ["api", "x-experimental"],
    plugins: {
        "hapi-swagger": {
            order: 10,
        },
    },
    validate: {
        payload: joi_1.default.object({
            orderIds: joi_1.default.array().items(joi_1.default.string().lowercase()),
            rawOrders: joi_1.default.array().items(joi_1.default.object({
                kind: joi_1.default.string()
                    .lowercase()
                    .valid("opensea", "looks-rare", "zeroex-v4", "seaport", "x2y2", "universe")
                    .required(),
                data: joi_1.default.object().required(),
            })),
            tokens: joi_1.default.array()
                .items(joi_1.default.string().lowercase().pattern(utils_1.regex.token))
                .description("Array of tokens user is buying. Example: `tokens[0]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:704 tokens[1]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:979`"),
            quantity: joi_1.default.number()
                .integer()
                .positive()
                .description("Quantity of tokens user is buying. Only compatible when buying a single ERC1155 token. Example: `5`"),
            taker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Address of wallet filling the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            onlyPath: joi_1.default.boolean()
                .default(false)
                .description("If true, only the path will be returned."),
            forceRouter: joi_1.default.boolean().description("If true, all fills will be executed through the router."),
            currency: joi_1.default.string()
                .pattern(utils_1.regex.address)
                .default(Sdk.Common.Addresses.Eth[index_2.config.chainId]),
            preferredOrderSource: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.domain)
                .when("tokens", { is: joi_1.default.exist(), then: joi_1.default.allow(), otherwise: joi_1.default.forbidden() }),
            source: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.domain)
                .description("Filling source used for attribution. Example: `reservoir.market`"),
            feesOnTop: joi_1.default.array()
                .items(joi_1.default.string().pattern(utils_1.regex.fee))
                .description("List of fees (formatted as `feeRecipient:feeAmount`) to be taken when filling. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00:1000000000000000`"),
            partial: joi_1.default.boolean()
                .default(false)
                .description("If true, partial orders will be accepted."),
            skipErrors: joi_1.default.boolean()
                .default(false)
                .description("If true, then skip any errors in processing."),
            maxFeePerGas: joi_1.default.string()
                .pattern(utils_1.regex.number)
                .description("Optional. Set custom gas price."),
            maxPriorityFeePerGas: joi_1.default.string()
                .pattern(utils_1.regex.number)
                .description("Optional. Set custom gas price."),
            skipBalanceCheck: joi_1.default.boolean()
                .default(false)
                .description("If true, balance check will be skipped."),
        })
            .or("tokens", "orderIds", "rawOrders")
            .oxor("tokens", "orderIds", "rawOrders"),
    },
    response: {
        schema: joi_1.default.object({
            steps: joi_1.default.array().items(joi_1.default.object({
                action: joi_1.default.string().required(),
                description: joi_1.default.string().required(),
                kind: joi_1.default.string().valid("transaction").required(),
                items: joi_1.default.array()
                    .items(joi_1.default.object({
                    status: joi_1.default.string().valid("complete", "incomplete").required(),
                    data: joi_1.default.object(),
                }))
                    .required(),
            })),
            path: joi_1.default.array().items(joi_1.default.object({
                orderId: joi_1.default.string(),
                contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                tokenId: joi_1.default.string().lowercase().pattern(utils_1.regex.number),
                quantity: joi_1.default.number().unsafe(),
                source: joi_1.default.string().allow("", null),
                currency: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                quote: joi_1.default.number().unsafe(),
                rawQuote: joi_1.default.string().pattern(utils_1.regex.number),
            })),
        }).label(`getExecuteBuy${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-buy-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a, _b, _c, _d;
        const payload = request.payload;
        try {
            // Terms of service not met
            const key = request.headers["x-api-key"];
            const apiKey = await api_keys_1.ApiKeyManager.getApiKey(key);
            if ((apiKey === null || apiKey === void 0 ? void 0 : apiKey.appName) === "NFTCLICK") {
                throw Boom.badRequest("Terms of service not met");
            }
            // Handle fees on top
            const feesOnTop = [];
            let totalFeesOnTop = (0, utils_1.bn)(0);
            for (const fee of (_a = payload.feesOnTop) !== null && _a !== void 0 ? _a : []) {
                const [recipient, amount] = fee.split(":");
                feesOnTop.push({ recipient, amount });
                totalFeesOnTop = totalFeesOnTop.add(amount);
            }
            // We need each filled order's source for the path
            const sources = await sources_1.Sources.getInstance();
            // Keep track of the listings and path to fill
            const listingDetails = [];
            const path = [];
            const addToPath = async (order, token) => {
                var _a, _b, _c, _d;
                const totalPrice = (0, utils_1.bn)(order.price).mul((_a = token.quantity) !== null && _a !== void 0 ? _a : 1);
                path.push({
                    orderId: order.id,
                    contract: token.contract,
                    tokenId: token.tokenId,
                    quantity: (_b = token.quantity) !== null && _b !== void 0 ? _b : 1,
                    source: order.sourceId !== null ? (_d = (_c = sources.get(order.sourceId)) === null || _c === void 0 ? void 0 : _c.domain) !== null && _d !== void 0 ? _d : null : null,
                    currency: order.currency,
                    quote: (0, utils_1.formatPrice)(totalPrice, (await (0, currencies_1.getCurrency)(order.currency)).decimals),
                    rawQuote: totalPrice.toString(),
                });
                listingDetails.push((0, orders_1.generateListingDetailsNew)({
                    kind: order.kind,
                    currency: order.currency,
                    rawData: order.rawData,
                }, {
                    kind: token.kind,
                    contract: token.contract,
                    tokenId: token.tokenId,
                    amount: token.quantity,
                }));
            };
            // Use a default quantity
            if (!payload.quantity) {
                payload.quantity = 1;
            }
            // Scenario 3: pass raw orders that don't yet exist
            if (payload.rawOrders) {
                // Hack: As raw orders are processed, push them to the `orderIds`
                // field so that they will get handled by the next pipeline step
                // of this same API rather than doing anything custom for it.
                payload.orderIds = [];
                for (const order of payload.rawOrders) {
                    const response = await (0, index_1.inject)({
                        method: "POST",
                        url: `/order/v2`,
                        headers: {
                            "Content-Type": "application/json",
                        },
                        payload: { order },
                    }).then((response) => JSON.parse(response.payload));
                    if (response.orderId) {
                        payload.orderIds.push(response.orderId);
                    }
                    else {
                        throw Boom.badData("Raw order failed to get processed");
                    }
                }
            }
            // Scenario 2: explicitly passing existing orders to fill
            if (payload.orderIds) {
                for (const orderId of payload.orderIds) {
                    const orderResult = await db_1.redb.oneOrNone(`
              SELECT
                orders.kind,
                contracts.kind AS token_kind,
                coalesce(orders.currency_price, orders.price) AS price,
                orders.raw_data,
                orders.source_id_int,
                orders.currency,
                token_sets_tokens.contract,
                token_sets_tokens.token_id
              FROM orders
              JOIN contracts
                ON orders.contract = contracts.address
              JOIN token_sets_tokens
                ON orders.token_set_id = token_sets_tokens.token_set_id
              WHERE orders.id = $/id/
                AND orders.side = 'sell'
                AND orders.fillability_status = 'fillable'
                AND orders.approval_status = 'approved'
                AND orders.quantity_remaining >= $/quantity/
                AND (orders.taker = '\\x0000000000000000000000000000000000000000' OR orders.taker IS NULL)
                AND orders.currency = $/currency/
            `, {
                        id: orderId,
                        currency: (0, utils_1.toBuffer)(payload.currency),
                        quantity: (_b = payload.quantity) !== null && _b !== void 0 ? _b : 1,
                    });
                    if (!orderResult) {
                        if (!payload.skipErrors) {
                            throw Boom.badData(`Could not use order id ${orderId}`);
                        }
                        else {
                            continue;
                        }
                    }
                    if (payload.quantity) {
                        if (orderResult.token_kind !== "erc1155") {
                            throw Boom.badRequest("Only ERC1155 orders support a quantity");
                        }
                        if (payload.orderIds.length > 1) {
                            throw Boom.badRequest("When specifying a quantity only a single ERC1155 order can get filled");
                        }
                    }
                    await addToPath({
                        id: orderId,
                        kind: orderResult.kind,
                        price: orderResult.price,
                        sourceId: orderResult.source_id_int,
                        currency: (0, utils_1.fromBuffer)(orderResult.currency),
                        rawData: orderResult.raw_data,
                    }, {
                        kind: orderResult.token_kind,
                        contract: (0, utils_1.fromBuffer)(orderResult.contract),
                        tokenId: orderResult.token_id,
                        quantity: (_c = payload.quantity) !== null && _c !== void 0 ? _c : 1,
                    });
                }
            }
            // Scenario 3: passing the tokens and quantity to fill
            if (payload.tokens) {
                const preferredOrderSource = (_d = sources.getByDomain(payload.preferredOrderSource)) === null || _d === void 0 ? void 0 : _d.id;
                for (const token of payload.tokens) {
                    const [contract, tokenId] = token.split(":");
                    if (payload.quantity === 1) {
                        // Filling a quantity of 1 implies getting the best listing for that token
                        const bestOrderResult = await db_1.redb.oneOrNone(`
                SELECT
                  orders.id,
                  orders.kind,
                  contracts.kind AS token_kind,
                  coalesce(orders.currency_price, orders.price) AS price,
                  orders.raw_data,
                  orders.source_id_int,
                  orders.currency
                FROM orders
                JOIN contracts
                  ON orders.contract = contracts.address
                WHERE orders.token_set_id = $/tokenSetId/
                  AND orders.side = 'sell'
                  AND orders.fillability_status = 'fillable'
                  AND orders.approval_status = 'approved'
                  AND (orders.taker = '\\x0000000000000000000000000000000000000000' OR orders.taker IS NULL)
                  AND orders.currency = $/currency/
                ORDER BY orders.value, ${preferredOrderSource
                            ? `(
                        CASE
                          WHEN orders.source_id_int = $/sourceId/ THEN 0
                          ELSE 1
                        END
                      )`
                            : "orders.fee_bps"}
                LIMIT 1
              `, {
                            tokenSetId: `token:${token}`,
                            currency: (0, utils_1.toBuffer)(payload.currency),
                            sourceId: preferredOrderSource,
                        });
                        if (!bestOrderResult) {
                            throw Boom.badRequest("No available orders");
                        }
                        const { id, kind, token_kind, price, source_id_int, currency, raw_data } = bestOrderResult;
                        await addToPath({
                            id,
                            kind,
                            price,
                            sourceId: source_id_int,
                            currency: (0, utils_1.fromBuffer)(currency),
                            rawData: raw_data,
                        }, {
                            kind: token_kind,
                            contract,
                            tokenId,
                        });
                    }
                    else {
                        // Fetch matching orders until the quantity to fill is met
                        const bestOrdersResult = await db_1.redb.manyOrNone(`
                SELECT
                  x.id,
                  x.kind,
                  x.token_kind,
                  coalesce(x.currency_price, x.price) AS price,
                  x.quantity_remaining,
                  x.source_id_int,
                  x.currency,
                  x.raw_data
                FROM (
                  SELECT
                    orders.*,
                    contracts.kind AS token_kind,
                    SUM(orders.quantity_remaining) OVER (
                      ORDER BY
                        price,
                        ${preferredOrderSource
                            ? `(
                                CASE
                                  WHEN orders.source_id_int = $/sourceId/ THEN 0
                                  ELSE 1
                                END
                              )`
                            : "orders.fee_bps"},
                        id
                    ) - orders.quantity_remaining AS quantity
                  FROM orders
                  JOIN contracts
                    ON orders.contract = contracts.address
                  WHERE orders.token_set_id = $/tokenSetId/
                    AND orders.side = 'sell'
                    AND orders.fillability_status = 'fillable'
                    AND orders.approval_status = 'approved'
                    AND (orders.taker = '\\x0000000000000000000000000000000000000000' OR orders.taker IS NULL)
                    AND orders.currency = $/currency/
                ) x WHERE x.quantity < $/quantity/
              `, {
                            tokenSetId: `token:${token}`,
                            quantity: payload.quantity,
                            currency: (0, utils_1.toBuffer)(payload.currency),
                            sourceId: preferredOrderSource,
                        });
                        if (!(bestOrdersResult === null || bestOrdersResult === void 0 ? void 0 : bestOrdersResult.length)) {
                            throw Boom.badRequest("No available orders");
                        }
                        if (bestOrdersResult.length &&
                            bestOrdersResult[0].token_kind === "erc1155" &&
                            payload.tokens.length > 1) {
                            throw Boom.badData("When specifying a quantity greater than one, only a single ERC1155 token can get filled");
                        }
                        let totalQuantityToFill = Number(payload.quantity);
                        for (const { id, kind, token_kind, quantity_remaining, price, source_id_int, currency, raw_data, } of bestOrdersResult) {
                            const quantityFilled = Math.min(Number(quantity_remaining), totalQuantityToFill);
                            totalQuantityToFill -= quantityFilled;
                            await addToPath({
                                id,
                                kind,
                                price,
                                sourceId: source_id_int,
                                currency: (0, utils_1.fromBuffer)(currency),
                                rawData: raw_data,
                            }, {
                                kind: token_kind,
                                contract,
                                tokenId,
                                quantity: quantityFilled,
                            });
                        }
                        // No available orders to fill the requested quantity
                        if (totalQuantityToFill > 0) {
                            throw Boom.badRequest("No available orders");
                        }
                    }
                }
            }
            if (!path.length) {
                throw Boom.badRequest("No fillable orders");
            }
            if (payload.quantity > 1) {
                if (!listingDetails.every((d) => d.contractKind === "erc1155")) {
                    throw Boom.badData("Only ERC1155 tokens support a quantity greater than one");
                }
            }
            if (payload.onlyPath) {
                // Only return the path if that's what was requested
                return { path };
            }
            const router = new Sdk.Router.Router(index_2.config.chainId, provider_1.baseProvider);
            const { txData, success } = await router.fillListingsTx(listingDetails, payload.taker, payload.currency, {
                source: payload.source,
                fees: feesOnTop,
                partial: payload.partial,
                skipErrors: payload.skipErrors,
                forceRouter: payload.forceRouter,
                directFillingData: {
                    conduitKey: index_2.config.chainId === 1
                        ? "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000"
                        : undefined,
                },
            });
            // Set up generic filling steps
            const steps = [
                {
                    action: "Approve exchange contract",
                    description: "A one-time setup transaction to enable trading",
                    kind: "transaction",
                    items: [],
                },
                {
                    action: "Confirm purchase",
                    description: "To purchase this item you must confirm the transaction and pay the gas fee",
                    kind: "transaction",
                    items: [],
                },
            ];
            // Check that the taker has enough funds to fill all requested tokens
            const totalPrice = path.map(({ rawQuote }) => (0, utils_1.bn)(rawQuote)).reduce((a, b) => a.add(b));
            if (payload.currency === Sdk.Common.Addresses.Eth[index_2.config.chainId]) {
                const balance = await provider_1.baseProvider.getBalance(payload.taker);
                if (!payload.skipBalanceCheck && (0, utils_1.bn)(balance).lt(totalPrice)) {
                    throw Boom.badData("Balance too low to proceed with transaction");
                }
            }
            else {
                const erc20 = new Sdk.Common.Helpers.Erc20(provider_1.baseProvider, payload.currency);
                const balance = await erc20.getBalance(payload.taker);
                if (!payload.skipBalanceCheck && (0, utils_1.bn)(balance).lt(totalPrice)) {
                    throw Boom.badData("Balance too low to proceed with transaction");
                }
                let conduit;
                if (listingDetails.every((d) => d.kind === "seaport")) {
                    // TODO: Have a default conduit for each exchange per chain
                    conduit =
                        index_2.config.chainId === 1
                            ? // Use OpenSea's conduit for sharing approvals
                                "0x1e0049783f008a0085193e00003d00cd54003c71"
                            : Sdk.Seaport.Addresses.Exchange[index_2.config.chainId];
                }
                else if (listingDetails.every((d) => d.kind === "universe")) {
                    conduit = Sdk.Universe.Addresses.Exchange[index_2.config.chainId];
                }
                else {
                    throw new Error("Only Seaport and Universe ERC20 listings are supported");
                }
                const allowance = await erc20.getAllowance(payload.taker, conduit);
                if ((0, utils_1.bn)(allowance).lt(totalPrice)) {
                    const tx = erc20.approveTransaction(payload.taker, conduit);
                    steps[0].items.push({
                        status: "incomplete",
                        data: {
                            ...tx,
                            maxFeePerGas: payload.maxFeePerGas
                                ? (0, utils_1.bn)(payload.maxFeePerGas).toHexString()
                                : undefined,
                            maxPriorityFeePerGas: payload.maxPriorityFeePerGas
                                ? (0, utils_1.bn)(payload.maxPriorityFeePerGas).toHexString()
                                : undefined,
                        },
                    });
                }
            }
            steps[1].items.push({
                status: "incomplete",
                data: {
                    ...txData,
                    maxFeePerGas: payload.maxFeePerGas ? (0, utils_1.bn)(payload.maxFeePerGas).toHexString() : undefined,
                    maxPriorityFeePerGas: payload.maxPriorityFeePerGas
                        ? (0, utils_1.bn)(payload.maxPriorityFeePerGas).toHexString()
                        : undefined,
                },
            });
            return {
                steps,
                // Remove any unsuccessfully handled listings from the path
                path: path.filter((_, i) => !success[i]),
            };
        }
        catch (error) {
            logger_1.logger.error(`get-execute-buy-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v6.js.map