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
exports.getExecuteBidV2Options = void 0;
const bytes_1 = require("@ethersproject/bytes");
const constants_1 = require("@ethersproject/constants");
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
// LooksRare
const looksRareBuyToken = __importStar(require("@/orderbook/orders/looks-rare/build/buy/token"));
const looksRareBuyCollection = __importStar(require("@/orderbook/orders/looks-rare/build/buy/collection"));
// Seaport
const seaportBuyAttribute = __importStar(require("@/orderbook/orders/seaport/build/buy/attribute"));
const seaportBuyToken = __importStar(require("@/orderbook/orders/seaport/build/buy/token"));
const seaportBuyCollection = __importStar(require("@/orderbook/orders/seaport/build/buy/collection"));
// ZeroExV4
const zeroExV4BuyAttribute = __importStar(require("@/orderbook/orders/zeroex-v4/build/buy/attribute"));
const zeroExV4BuyToken = __importStar(require("@/orderbook/orders/zeroex-v4/build/buy/token"));
const zeroExV4BuyCollection = __importStar(require("@/orderbook/orders/zeroex-v4/build/buy/collection"));
const version = "v2";
exports.getExecuteBidV2Options = {
    description: "Create bid (offer)",
    notes: "Generate a bid and submit it to multiple marketplaces",
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
                .description("Bid on a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            tokenSetId: joi_1.default.string().lowercase().description("Bid on a particular token set."),
            collection: joi_1.default.string()
                .lowercase()
                .description("Bid on a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            attributeKey: joi_1.default.string().description("Bid on a particular attribute key. Example: `Composition`"),
            attributeValue: joi_1.default.string().description("Bid on a particular attribute value. Example: `Teddy (#33)`"),
            quantity: joi_1.default.number().description("Quanity of tokens user is buying. Only compatible with ERC1155 tokens. Example: `5`"),
            maker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Address of wallet making the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`")
                .required(),
            weiPrice: joi_1.default.string()
                .pattern(utils_1.regex.number)
                .description("Amount bidder is willing to offer in wei. Example: `1000000000000000000`")
                .required(),
            orderKind: joi_1.default.string()
                .valid("looks-rare", "zeroex-v4", "seaport")
                .default("seaport")
                .description("Exchange protocol used to create order. Example: `seaport`"),
            orderbook: joi_1.default.string()
                .valid("reservoir", "opensea", "looks-rare")
                .default("reservoir")
                .description("Orderbook where order is placed. Example: `Reservoir`"),
            source: joi_1.default.string().description("Name of the platform that created the order. Example: `Chimpers Market`"),
            automatedRoyalties: joi_1.default.boolean()
                .default(true)
                .description("If true, royalties will be automatically included."),
            fee: joi_1.default.alternatives(joi_1.default.string().pattern(utils_1.regex.number), joi_1.default.number()).description("Fee amount in BPS. Example: `100`"),
            excludeFlaggedTokens: joi_1.default.boolean()
                .default(false)
                .description("If true flagged tokens will be excluded"),
            feeRecipient: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Wallet address of fee recipient. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`")
                .disallow(constants_1.AddressZero),
            listingTime: joi_1.default.string()
                .pattern(utils_1.regex.unixTimestamp)
                .description("Unix timestamp (seconds) indicating when listing will be listed. Example: `1656080318`"),
            expirationTime: joi_1.default.string()
                .pattern(utils_1.regex.unixTimestamp)
                .description("Unix timestamp (seconds) indicating when listing will expire. Example: `1656080318`"),
            salt: joi_1.default.string()
                .pattern(/^\d+$/)
                .description("Optional. Random string to make the order unique"),
            nonce: joi_1.default.string().pattern(utils_1.regex.number).description("Optional. Set a custom nonce"),
            v: joi_1.default.number().description("Signature v component (only required after order has been signed)"),
            r: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.bytes32)
                .description("Signature r component (only required after order has been signed)"),
            s: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.bytes32)
                .description("Signature s component (only required after order has been signed)"),
        })
            .or("token", "collection", "tokenSetId")
            .oxor("token", "collection", "tokenSetId")
            .with("attributeValue", "attributeKey")
            .with("attributeKey", "attributeValue")
            .with("attributeKey", "collection")
            .with("feeRecipient", "fee")
            .with("fee", "feeRecipient"),
    },
    response: {
        schema: joi_1.default.object({
            steps: joi_1.default.array().items(joi_1.default.object({
                action: joi_1.default.string().required(),
                description: joi_1.default.string().required(),
                status: joi_1.default.string().valid("complete", "incomplete").required(),
                kind: joi_1.default.string().valid("request", "signature", "transaction").required(),
                data: joi_1.default.object(),
            })),
            query: joi_1.default.object(),
        }).label(`getExecuteBid${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-execute-bid-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        var _a, _b, _c, _d;
        const query = request.query;
        try {
            const token = query.token;
            const collection = query.collection;
            const tokenSetId = query.tokenSetId;
            const attributeKey = query.attributeKey;
            const attributeValue = query.attributeValue;
            // TODO: Re-enable collection/attribute bids on external orderbooks
            if (!token && query.orderbook !== "reservoir") {
                throw Boom.badRequest("Only single-token bids are supported on external orderbooks");
            }
            // Set up generic bid creation steps
            const steps = [
                {
                    action: "Wrapping ETH",
                    description: "We'll ask your approval for converting ETH to WETH. Gas fee required.",
                    kind: "transaction",
                },
                {
                    action: "Approve WETH contract",
                    description: "We'll ask your approval for the exchange to access your token. This is a one-time only operation per exchange.",
                    kind: "transaction",
                },
                {
                    action: "Authorize offer",
                    description: "A free off-chain signature to create the offer",
                    kind: "signature",
                },
                {
                    action: "Submit offer",
                    description: "Post your offer to the order book for others to discover it",
                    kind: "request",
                },
            ];
            // Check the maker's Weth/Eth balance
            let wrapEthTx;
            const weth = new Sdk.Common.Helpers.Weth(provider_1.baseProvider, index_1.config.chainId);
            const wethBalance = await weth.getBalance(query.maker);
            if ((0, utils_1.bn)(wethBalance).lt(query.weiPrice)) {
                const ethBalance = await provider_1.baseProvider.getBalance(query.maker);
                if ((0, utils_1.bn)(wethBalance).add(ethBalance).lt(query.weiPrice)) {
                    // We cannot do anything if the maker doesn't have sufficient balance
                    throw Boom.badData("Maker does not have sufficient balance");
                }
                else {
                    wrapEthTx = weth.depositTransaction(query.maker, (0, utils_1.bn)(query.weiPrice).sub(wethBalance));
                }
            }
            switch (query.orderKind) {
                case "seaport": {
                    if (!["reservoir", "opensea"].includes(query.orderbook)) {
                        throw Boom.badRequest("Unsupported orderbook");
                    }
                    // We want the fee params as arrays
                    if (query.fee && !Array.isArray(query.fee)) {
                        query.fee = [query.fee];
                    }
                    if (query.feeRecipient && !Array.isArray(query.feeRecipient)) {
                        query.feeRecipient = [query.feeRecipient];
                    }
                    if (((_a = query.fee) === null || _a === void 0 ? void 0 : _a.length) !== ((_b = query.feeRecipient) === null || _b === void 0 ? void 0 : _b.length)) {
                        throw Boom.badRequest("Invalid fee info");
                    }
                    let order;
                    if (token) {
                        const [contract, tokenId] = token.split(":");
                        order = await seaportBuyToken.build({
                            ...query,
                            contract,
                            tokenId,
                        });
                    }
                    else if (tokenSetId || (collection && attributeKey && attributeValue)) {
                        order = await seaportBuyAttribute.build({
                            ...query,
                            collection,
                            attributes: [
                                {
                                    key: attributeKey,
                                    value: attributeValue,
                                },
                            ],
                        });
                    }
                    else if (collection) {
                        order = await seaportBuyCollection.build({
                            ...query,
                            collection,
                        });
                    }
                    else {
                        throw Boom.internal("Wrong metadata");
                    }
                    const exchange = new Sdk.Seaport.Exchange(index_1.config.chainId);
                    const conduit = exchange.deriveConduit(order.params.conduitKey);
                    // Check the maker's WETH approval
                    let approvalTx;
                    const wethApproval = await weth.getAllowance(query.maker, conduit);
                    if ((0, utils_1.bn)(wethApproval).lt(order.getMatchingPrice())) {
                        approvalTx = weth.approveTransaction(query.maker, conduit);
                    }
                    const hasSignature = query.v && query.r && query.s;
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: !wrapEthTx ? "complete" : "incomplete",
                                data: wrapEthTx,
                            },
                            {
                                ...steps[1],
                                status: !approvalTx ? "complete" : "incomplete",
                                data: approvalTx,
                            },
                            {
                                ...steps[2],
                                status: hasSignature ? "complete" : "incomplete",
                                data: hasSignature ? undefined : order.getSignatureData(),
                            },
                            {
                                ...steps[3],
                                status: "incomplete",
                                data: !hasSignature
                                    ? undefined
                                    : {
                                        endpoint: "/order/v2",
                                        method: "POST",
                                        body: {
                                            order: {
                                                kind: "seaport",
                                                data: {
                                                    ...order.params,
                                                    // Seaport requires the joined signature
                                                    signature: (0, bytes_1.joinSignature)({ v: query.v, r: query.r, s: query.s }),
                                                },
                                            },
                                            tokenSetId,
                                            attribute: collection && attributeKey && attributeValue
                                                ? {
                                                    collection,
                                                    key: attributeKey,
                                                    value: attributeValue,
                                                }
                                                : undefined,
                                            collection: collection && !attributeKey && !attributeValue ? collection : undefined,
                                            isNonFlagged: query.excludeFlaggedTokens,
                                            orderbook: query.orderbook,
                                            source: query.source,
                                        },
                                    },
                            },
                        ],
                        query: {
                            ...query,
                            listingTime: order.params.startTime,
                            expirationTime: order.params.endTime,
                            salt: order.params.salt,
                        },
                    };
                }
                case "zeroex-v4": {
                    if (!["reservoir"].includes(query.orderbook)) {
                        throw Boom.badRequest("Unsupported orderbook");
                    }
                    // Make sure the fee information is correctly types
                    if (query.fee && !Array.isArray(query.fee)) {
                        query.fee = [query.fee];
                    }
                    if (query.feeRecipient && !Array.isArray(query.feeRecipient)) {
                        query.feeRecipient = [query.feeRecipient];
                    }
                    if (((_c = query.fee) === null || _c === void 0 ? void 0 : _c.length) !== ((_d = query.feeRecipient) === null || _d === void 0 ? void 0 : _d.length)) {
                        throw Boom.badRequest("Invalid fee information");
                    }
                    let order;
                    if (token) {
                        const [contract, tokenId] = token.split(":");
                        order = await zeroExV4BuyToken.build({
                            ...query,
                            contract,
                            tokenId,
                        });
                    }
                    else if (tokenSetId || (collection && attributeKey && attributeValue)) {
                        order = await zeroExV4BuyAttribute.build({
                            ...query,
                            collection,
                            attributes: [
                                {
                                    key: attributeKey,
                                    value: attributeValue,
                                },
                            ],
                        });
                    }
                    else if (collection) {
                        order = await zeroExV4BuyCollection.build({
                            ...query,
                            collection,
                        });
                    }
                    if (!order) {
                        throw Boom.internal("Failed to generate order");
                    }
                    // Check the maker's approval
                    let approvalTx;
                    const wethApproval = await weth.getAllowance(query.maker, Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId]);
                    if ((0, utils_1.bn)(wethApproval).lt((0, utils_1.bn)(order.params.erc20TokenAmount).add(order.getFeeAmount()))) {
                        approvalTx = weth.approveTransaction(query.maker, Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId]);
                    }
                    const hasSignature = query.v && query.r && query.s;
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: !wrapEthTx ? "complete" : "incomplete",
                                data: wrapEthTx,
                            },
                            {
                                ...steps[1],
                                status: !approvalTx ? "complete" : "incomplete",
                                data: approvalTx,
                            },
                            {
                                ...steps[2],
                                status: hasSignature ? "complete" : "incomplete",
                                data: hasSignature ? undefined : order.getSignatureData(),
                            },
                            {
                                ...steps[3],
                                status: "incomplete",
                                data: !hasSignature
                                    ? undefined
                                    : {
                                        endpoint: "/order/v2",
                                        method: "POST",
                                        body: {
                                            order: {
                                                kind: "zeroex-v4",
                                                data: {
                                                    ...order.params,
                                                    v: query.v,
                                                    r: query.r,
                                                    s: query.s,
                                                },
                                            },
                                            tokenSetId,
                                            attribute: collection && attributeKey && attributeValue
                                                ? {
                                                    collection,
                                                    key: attributeKey,
                                                    value: attributeValue,
                                                }
                                                : undefined,
                                            collection: collection && !attributeKey && !attributeValue ? collection : undefined,
                                            isNonFlagged: query.excludeFlaggedTokens,
                                            orderbook: query.orderbook,
                                            source: query.source,
                                        },
                                    },
                            },
                        ],
                        query: {
                            ...query,
                            expirationTime: order.params.expiry,
                            nonce: order.params.nonce,
                        },
                    };
                }
                case "looks-rare": {
                    if (!["reservoir", "looks-rare"].includes(query.orderbook)) {
                        throw Boom.badRequest("Unsupported orderbook");
                    }
                    if (query.fee || query.feeRecipient) {
                        throw Boom.badRequest("LooksRare does not support explicit fees");
                    }
                    if (query.excludeFlaggedTokens) {
                        throw Boom.badRequest("LooksRare does not support token-list bids");
                    }
                    let order;
                    if (token) {
                        const [contract, tokenId] = token.split(":");
                        order = await looksRareBuyToken.build({
                            ...query,
                            contract,
                            tokenId,
                        });
                    }
                    else if (collection && !attributeKey && !attributeValue) {
                        order = await looksRareBuyCollection.build({
                            ...query,
                            collection,
                        });
                    }
                    else {
                        throw Boom.badRequest("LooksRare only supports single-token or collection-wide bids");
                    }
                    if (!order) {
                        throw Boom.internal("Failed to generate order");
                    }
                    // Check the maker's approval
                    let approvalTx;
                    const wethApproval = await weth.getAllowance(query.maker, Sdk.LooksRare.Addresses.Exchange[index_1.config.chainId]);
                    if ((0, utils_1.bn)(wethApproval).lt((0, utils_1.bn)(order.params.price))) {
                        approvalTx = weth.approveTransaction(query.maker, Sdk.LooksRare.Addresses.Exchange[index_1.config.chainId]);
                    }
                    const hasSignature = query.v && query.r && query.s;
                    return {
                        steps: [
                            {
                                ...steps[0],
                                status: !wrapEthTx ? "complete" : "incomplete",
                                data: wrapEthTx,
                            },
                            {
                                ...steps[1],
                                status: !approvalTx ? "complete" : "incomplete",
                                data: approvalTx,
                            },
                            {
                                ...steps[2],
                                status: hasSignature ? "complete" : "incomplete",
                                data: hasSignature ? undefined : order.getSignatureData(),
                            },
                            {
                                ...steps[3],
                                status: "incomplete",
                                data: !hasSignature
                                    ? undefined
                                    : {
                                        endpoint: "/order/v2",
                                        method: "POST",
                                        body: {
                                            order: {
                                                kind: "looks-rare",
                                                data: {
                                                    ...order.params,
                                                    v: query.v,
                                                    r: query.r,
                                                    s: query.s,
                                                },
                                            },
                                            tokenSetId,
                                            collection: collection && !attributeKey && !attributeValue ? collection : undefined,
                                            orderbook: query.orderbook,
                                            source: query.source,
                                        },
                                    },
                            },
                        ],
                        query: {
                            ...query,
                            expirationTime: order.params.endTime,
                            nonce: order.params.nonce,
                        },
                    };
                }
            }
        }
        catch (error) {
            logger_1.logger.error(`get-execute-bid-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map