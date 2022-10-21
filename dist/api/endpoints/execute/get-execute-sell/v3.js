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
exports.getExecuteSellV3Options = void 0;
const constants_1 = require("@ethersproject/constants");
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const sources_1 = require("@/models/sources");
const orders_1 = require("@/orderbook/orders");
const helpers_1 = require("@/orderbook/orders/common/helpers");
const version = "v3";
exports.getExecuteSellV3Options = {
    description: "Sell tokens (accept bids)",
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
                .required()
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            taker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .required()
                .description("Address of wallet filling the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            source: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.domain)
                .description("Filling source used for attribution. Example: `reservoir.market`"),
            referrer: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .default(constants_1.AddressZero)
                .description("Wallet address of referrer. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`"),
            onlyPath: joi_1.default.boolean()
                .default(false)
                .description("If true, only the path will be returned."),
            maxFeePerGas: joi_1.default.string()
                .pattern(utils_1.regex.number)
                .description("Optional. Set custom gas price."),
            maxPriorityFeePerGas: joi_1.default.string()
                .pattern(utils_1.regex.number)
                .description("Optional. Set custom gas price."),
        }),
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
        }).label(`getExecuteSell${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-sell-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a, _b;
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
            orders.source_id_int,
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
            // Return early in case no offer is available
            if (!bestOrderResult) {
                throw Boom.badRequest("No available orders");
            }
            const sources = await sources_1.Sources.getInstance();
            const sourceId = bestOrderResult.source_id_int;
            const path = [
                {
                    orderId: bestOrderResult.id,
                    contract,
                    tokenId,
                    quantity: 1,
                    source: sourceId ? (_b = (_a = sources.get(sourceId)) === null || _a === void 0 ? void 0 : _a.domain) !== null && _b !== void 0 ? _b : null : null,
                    // TODO: Add support for multiple currencies
                    currency: Sdk.Common.Addresses.Weth[index_1.config.chainId],
                    quote: (0, utils_1.formatEth)(bestOrderResult.price),
                    rawQuote: bestOrderResult.price,
                },
            ];
            if (query.onlyPath) {
                // Skip generating any transactions if only the path was requested
                return { path };
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
                    action: "Approve NFT contract",
                    description: "Each NFT collection you want to trade requires a one-time approval transaction",
                    kind: "transaction",
                    items: [],
                },
                {
                    action: "Accept offer",
                    description: "To sell this item you must confirm the transaction and pay the gas fee",
                    kind: "transaction",
                    items: [],
                },
            ];
            // X2Y2/Sudoswap bids are to be filled directly (because the V5 router does not support them)
            if (bidDetails.kind === "x2y2") {
                const isApproved = await (0, helpers_1.getNftApproval)(bidDetails.contract, query.taker, Sdk.X2Y2.Addresses.Exchange[index_1.config.chainId]);
                if (!isApproved) {
                    // TODO: Add support for X2Y2 ERC1155 orders
                    const approveTx = new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, bidDetails.contract).approveTransaction(query.taker, Sdk.X2Y2.Addresses.Exchange[index_1.config.chainId]);
                    steps[0].items.push({
                        status: "incomplete",
                        data: {
                            ...approveTx,
                            maxFeePerGas: query.maxFeePerGas ? (0, utils_1.bn)(query.maxFeePerGas).toHexString() : undefined,
                            maxPriorityFeePerGas: query.maxPriorityFeePerGas
                                ? (0, utils_1.bn)(query.maxPriorityFeePerGas).toHexString()
                                : undefined,
                        },
                    });
                }
            }
            if (bidDetails.kind === "sudoswap") {
                const isApproved = await (0, helpers_1.getNftApproval)(bidDetails.contract, query.taker, Sdk.Sudoswap.Addresses.RouterWithRoyalties[index_1.config.chainId]);
                if (!isApproved) {
                    const approveTx = new Sdk.Common.Helpers.Erc721(provider_1.baseProvider, bidDetails.contract).approveTransaction(query.taker, Sdk.Sudoswap.Addresses.RouterWithRoyalties[index_1.config.chainId]);
                    steps[0].items.push({
                        status: "incomplete",
                        data: {
                            ...approveTx,
                            maxFeePerGas: query.maxFeePerGas ? (0, utils_1.bn)(query.maxFeePerGas).toHexString() : undefined,
                            maxPriorityFeePerGas: query.maxPriorityFeePerGas
                                ? (0, utils_1.bn)(query.maxPriorityFeePerGas).toHexString()
                                : undefined,
                        },
                    });
                }
            }
            steps[1].items.push({
                status: "incomplete",
                data: {
                    ...tx,
                    maxFeePerGas: query.maxFeePerGas ? (0, utils_1.bn)(query.maxFeePerGas).toHexString() : undefined,
                    maxPriorityFeePerGas: query.maxPriorityFeePerGas
                        ? (0, utils_1.bn)(query.maxPriorityFeePerGas).toHexString()
                        : undefined,
                },
            });
            return {
                steps,
                path,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-execute-sell-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v3.js.map