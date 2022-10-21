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
exports.getExecuteBuyV2Options = void 0;
const constants_1 = require("@ethersproject/constants");
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const api_keys_1 = require("@/models/api-keys");
const sources_1 = require("@/models/sources");
const orders_1 = require("@/orderbook/orders");
const version = "v2";
exports.getExecuteBuyV2Options = {
    description: "Buy a token at the best price",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            token: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            quantity: joi_1.default.number()
                .integer()
                .positive()
                .description("Quanity of tokens user is buying. Only compatible with ERC1155 tokens. Example: `5`"),
            tokens: joi_1.default.array().items(joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Array of tokens user is buying. Example: `tokens[0]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:704 tokens[1]: 0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:979`")),
            taker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Address of wallet filling the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            onlyQuote: joi_1.default.boolean().default(false).description("If true, only quote will be returned."),
            source: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.domain)
                .description("Filling source used for attribution. Example: `reservoir.market`"),
            referrer: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .default(constants_1.AddressZero)
                .description("Wallet address of referrer. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            referrerFeeBps: joi_1.default.number()
                .integer()
                .min(0)
                .max(10000)
                .default(0)
                .description("Fee amount in BPS. Example: `100`."),
            partial: joi_1.default.boolean()
                .default(false)
                .description("If true, partial orders will be accepted."),
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
            .or("token", "tokens")
            .oxor("token", "tokens")
            .with("quantity", "token"),
    },
    response: {
        schema: joi_1.default.object({
            steps: joi_1.default.array().items(joi_1.default.object({
                action: joi_1.default.string().required(),
                description: joi_1.default.string().required(),
                status: joi_1.default.string().valid("complete", "incomplete").required(),
                kind: joi_1.default.string()
                    .valid("request", "signature", "transaction", "confirmation")
                    .required(),
                data: joi_1.default.object(),
            })),
            quote: joi_1.default.number().unsafe(),
            path: joi_1.default.array().items(joi_1.default.object({
                contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                tokenId: joi_1.default.string().lowercase().pattern(utils_1.regex.number),
                quantity: joi_1.default.number().unsafe(),
                source: joi_1.default.string().allow("", null),
                quote: joi_1.default.number().unsafe(),
            })),
            query: joi_1.default.object(),
        }).label(`getExecuteBuy${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-buy-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a, _b, _c, _d;
        const query = request.query;
        try {
            // Terms of service not met
            const key = request.headers["x-api-key"];
            const apiKey = await api_keys_1.ApiKeyManager.getApiKey(key);
            if ((apiKey === null || apiKey === void 0 ? void 0 : apiKey.appName) === "NFTCLICK") {
                throw Boom.badRequest("Terms of service not met");
            }
            // We need each filled order's source for the path
            const sources = await sources_1.Sources.getInstance();
            // Keep track of the filled path
            const path = [];
            let confirmationQuery = "";
            // Consistently handle a single token vs multiple tokens
            let tokens = [];
            if (query.token) {
                tokens = [query.token];
            }
            else {
                tokens = query.tokens;
            }
            // Use a default quantity if missing
            if (!query.quantity) {
                query.quantity = 1;
            }
            const listingDetails = [];
            for (const token of tokens) {
                const [contract, tokenId] = token.split(":");
                if (query.quantity === 1) {
                    // Filling a quantity of 1 implies getting the best listing for that token
                    const bestOrderResult = await db_1.redb.oneOrNone(`
              SELECT
                orders.id,
                orders.kind,
                contracts.kind AS token_kind,
                orders.price,
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
                AND orders.currency = '\\x0000000000000000000000000000000000000000'
              ORDER BY orders.value, orders.fee_bps
              LIMIT 1
            `, { tokenSetId: `token:${contract}:${tokenId}` });
                    if (!bestOrderResult) {
                        // Return early in case no listing is available
                        throw Boom.badRequest("No available orders");
                    }
                    const { id, kind, token_kind, price, source_id_int, currency, raw_data } = bestOrderResult;
                    path.push({
                        contract,
                        tokenId,
                        quantity: 1,
                        source: (_b = (_a = sources.get(source_id_int)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : null,
                        quote: (0, utils_1.formatEth)((0, utils_1.bn)(price).add((0, utils_1.bn)(price).mul(query.referrerFeeBps).div(10000))),
                    });
                    if (query.onlyQuote) {
                        // Skip generating any transactions if only the quote was requested
                        continue;
                    }
                    listingDetails.push((0, orders_1.generateListingDetails)({
                        kind,
                        currency: (0, utils_1.fromBuffer)(currency),
                        rawData: raw_data,
                    }, {
                        kind: token_kind,
                        contract,
                        tokenId,
                    }));
                    confirmationQuery += `${confirmationQuery.length ? "&" : "?"}ids=${id}`;
                }
                else {
                    // Only ERC1155 tokens support a quantity greater than 1
                    const kindResult = await db_1.redb.one(`
              SELECT contracts.kind FROM contracts
              WHERE contracts.address = $/contract/
            `, { contract: (0, utils_1.toBuffer)(contract) });
                    if ((kindResult === null || kindResult === void 0 ? void 0 : kindResult.kind) !== "erc1155") {
                        throw Boom.badData("Unsupported token kind");
                    }
                    // Fetch matching orders until the quantity to fill is met
                    const bestOrdersResult = await db_1.redb.manyOrNone(`
              SELECT
                x.id,
                x.kind,
                x.price,
                x.quantity_remaining,
                x.source_id_int,
                x.raw_data,
                x.currency
              FROM (
                SELECT
                  orders.*,
                  SUM(orders.quantity_remaining) OVER (ORDER BY price, fee_bps, id) - orders.quantity_remaining AS quantity
                FROM orders
                WHERE orders.token_set_id = $/tokenSetId/
                  AND orders.side = 'sell'
                  AND orders.fillability_status = 'fillable'
                  AND orders.approval_status = 'approved'
                  AND (orders.taker = '\\x0000000000000000000000000000000000000000' OR orders.taker IS NULL)
                  AND orders.currency = '\\x0000000000000000000000000000000000000000'
              ) x WHERE x.quantity < $/quantity/
            `, {
                        tokenSetId: `token:${query.token}`,
                        quantity: query.quantity,
                    });
                    if (!(bestOrdersResult === null || bestOrdersResult === void 0 ? void 0 : bestOrdersResult.length)) {
                        throw Boom.badRequest("No available orders");
                    }
                    let totalQuantityToFill = Number(query.quantity);
                    for (const { id, kind, quantity_remaining, price, source_id_int, currency, raw_data, } of bestOrdersResult) {
                        const quantityFilled = Math.min(Number(quantity_remaining), totalQuantityToFill);
                        totalQuantityToFill -= quantityFilled;
                        const totalPrice = (0, utils_1.bn)(price).mul(quantityFilled);
                        path.push({
                            contract,
                            tokenId,
                            quantity: quantityFilled,
                            source: (_d = (_c = sources.get(source_id_int)) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : null,
                            quote: (0, utils_1.formatEth)(totalPrice.add(totalPrice.mul(query.referrerFeeBps).div(10000))),
                        });
                        if (query.onlyQuote) {
                            // Skip generating any transactions if only the quote was requested
                            continue;
                        }
                        listingDetails.push((0, orders_1.generateListingDetails)({
                            kind,
                            currency: (0, utils_1.fromBuffer)(currency),
                            rawData: raw_data,
                        }, {
                            kind: "erc1155",
                            contract,
                            tokenId,
                            amount: quantityFilled,
                        }));
                        confirmationQuery = `?ids=${id}`;
                    }
                    // No available orders to fill the requested quantity
                    if (totalQuantityToFill > 0) {
                        throw Boom.badRequest("No available orders");
                    }
                }
            }
            const quote = path.map((p) => p.quote).reduce((a, b) => a + b, 0);
            if (query.onlyQuote) {
                // Only return the quote if that's what was requested
                return { quote, path };
            }
            // Use either the source or the old referrer
            if (!query.source && query.referrer !== constants_1.AddressZero) {
                const source = sources.getByAddress(query.referrer);
                if (source) {
                    query.source = source.domain;
                }
            }
            const router = new Sdk.Router.Router(index_1.config.chainId, provider_1.baseProvider);
            const tx = await router.fillListingsTx(listingDetails, query.taker, {
                referrer: query.source,
                fee: {
                    recipient: query.referrer,
                    bps: query.referrerFeeBps,
                },
                partial: query.partial,
                // Force router filling so that we don't lose any attribution
                forceRouter: true,
            });
            // Check that the taker has enough funds to fill all requested tokens
            const balance = await provider_1.baseProvider.getBalance(query.taker);
            if (!query.skipBalanceCheck && (0, utils_1.bn)(balance).lt(tx.value)) {
                throw Boom.badData("ETH balance too low to proceed with transaction");
            }
            // Set up generic filling steps
            const steps = [
                {
                    action: "Confirm purchase",
                    description: "To purchase this item you must confirm the transaction and pay the gas fee",
                    kind: "transaction",
                },
                {
                    action: "Confirmation",
                    description: "Verify that the item was successfully purchased",
                    kind: "confirmation",
                },
            ];
            return {
                steps: [
                    {
                        ...steps[0],
                        status: "incomplete",
                        data: {
                            ...tx,
                            maxFeePerGas: query.maxFeePerGas ? (0, utils_1.bn)(query.maxFeePerGas).toHexString() : undefined,
                            maxPriorityFeePerGas: query.maxPriorityFeePerGas
                                ? (0, utils_1.bn)(query.maxPriorityFeePerGas).toHexString()
                                : undefined,
                        },
                    },
                    {
                        ...steps[1],
                        status: "incomplete",
                        data: {
                            endpoint: `/orders/executed/v1${confirmationQuery}`,
                            method: "GET",
                        },
                    },
                ],
                quote,
                path,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-execute-buy-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map