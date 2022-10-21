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
exports.getExecuteSellV1Options = void 0;
const constants_1 = require("@ethersproject/constants");
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const orders_1 = require("@/orderbook/orders");
const version = "v1";
exports.getExecuteSellV1Options = {
    description: "Sell any token at the best available price (accept bid)",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            deprecated: true,
        },
    },
    validate: {
        query: joi_1.default.object({
            token: joi_1.default.string().lowercase().pattern(utils_1.regex.token).required(),
            taker: joi_1.default.string().lowercase().pattern(utils_1.regex.address).required(),
            source: joi_1.default.string(),
            referrer: joi_1.default.string().lowercase().pattern(utils_1.regex.address).default(constants_1.AddressZero),
            onlyQuote: joi_1.default.boolean().default(false),
            maxFeePerGas: joi_1.default.string().pattern(utils_1.regex.number),
            maxPriorityFeePerGas: joi_1.default.string().pattern(utils_1.regex.number),
        }),
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
            query: joi_1.default.object(),
        }).label(`getExecuteSell${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-sell-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            const [contract, tokenId] = query.token.split(":");
            // Fetch the best offer on the current token
            const bestOrderResult = await db_1.redb.oneOrNone(`
          SELECT
            orders.id,
            orders.kind,
            contracts.kind AS token_kind,
            orders.price,
            orders.raw_data,
            orders.maker,
            orders.token_set_id
          FROM orders
          JOIN contracts
            ON orders.contract = contracts.address
          JOIN token_sets_tokens
            ON orders.token_set_id = token_sets_tokens.token_set_id
          WHERE token_sets_tokens.contract = $/contract/
            AND token_sets_tokens.token_id = $/tokenId/
            AND orders.side = 'buy'
            AND orders.fillability_status = 'fillable'
            AND orders.approval_status = 'approved'
            AND (orders.taker = '\\x0000000000000000000000000000000000000000' OR orders.taker IS NULL)
          ORDER BY orders.value DESC
          LIMIT 1
        `, {
                contract: (0, utils_1.toBuffer)(contract),
                tokenId,
            });
            if (!bestOrderResult) {
                throw Boom.badRequest("No available orders");
            }
            // The quote is the best offer's price
            const quote = (0, utils_1.formatEth)(bestOrderResult.price);
            if (query.onlyQuote) {
                // Skip generating any transactions if only the quote was requested
                return { quote };
            }
            const bidDetails = await (0, orders_1.generateBidDetails)({
                kind: bestOrderResult.kind,
                rawData: bestOrderResult.raw_data,
            }, {
                kind: bestOrderResult.token_kind,
                contract,
                tokenId,
            });
            const router = new Sdk.Router.Router(index_1.config.chainId, provider_1.baseProvider);
            const tx = await router.fillBidTx(bidDetails, query.taker, {
                referrer: query.source,
            });
            // Set up generic filling steps
            const steps = [
                {
                    action: "Accept offer",
                    description: "To sell this item you must confirm the transaction and pay the gas fee",
                    kind: "transaction",
                },
                {
                    action: "Confirmation",
                    description: "Verify that the offer was successfully accepted",
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
                            endpoint: `/orders/executed/v1?ids=${bestOrderResult.id}`,
                            method: "GET",
                        },
                    },
                ],
                quote,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-execute-sell-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map