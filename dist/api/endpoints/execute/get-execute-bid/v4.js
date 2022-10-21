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
exports.getExecuteBidV4Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const joi_1 = __importDefault(require("joi"));
const lodash_1 = __importDefault(require("lodash"));
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
// X2Y2
const x2y2BuyCollection = __importStar(require("@/orderbook/orders/x2y2/build/buy/collection"));
const x2y2BuyToken = __importStar(require("@/orderbook/orders/x2y2/build/buy/token"));
// ZeroExV4
const zeroExV4BuyAttribute = __importStar(require("@/orderbook/orders/zeroex-v4/build/buy/attribute"));
const zeroExV4BuyToken = __importStar(require("@/orderbook/orders/zeroex-v4/build/buy/token"));
const zeroExV4BuyCollection = __importStar(require("@/orderbook/orders/zeroex-v4/build/buy/collection"));
// Universe
const universeBuyToken = __importStar(require("@/orderbook/orders/universe/build/buy/token"));
const version = "v4";
exports.getExecuteBidV4Options = {
    description: "Create bid (offer)",
    notes: "Generate a bid and submit it to multiple marketplaces",
    timeout: { server: 60000 },
    tags: ["api", "Orderbook"],
    plugins: {
        "hapi-swagger": {
            order: 11,
        },
    },
    validate: {
        payload: joi_1.default.object({
            maker: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Address of wallet making the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00`")
                .required(),
            source: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.domain)
                .description(`Domain of your app that is creating the order, e.g. \`myapp.xyz\`. This is used for filtering, and to attribute the "order source" of sales in on-chain analytics, to help your app get discovered. Lean more <a href='https://docs.reservoir.tools/docs/calldata-attribution'>here</a>`),
            params: joi_1.default.array().items(joi_1.default.object({
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
                quantity: joi_1.default.number().description("Quantity of tokens user is buying. Only compatible with ERC1155 tokens. Example: `5`"),
                weiPrice: joi_1.default.string()
                    .pattern(utils_1.regex.number)
                    .description("Amount bidder is willing to offer in wei. Example: `1000000000000000000`")
                    .required(),
                orderKind: joi_1.default.string()
                    .valid("zeroex-v4", "seaport", "looks-rare", "x2y2", "universe")
                    .default("seaport")
                    .description("Exchange protocol used to create order. Example: `seaport`"),
                orderbook: joi_1.default.string()
                    .valid("reservoir", "opensea", "looks-rare", "x2y2", "universe")
                    .default("reservoir")
                    .description("Orderbook where order is placed. Example: `Reservoir`"),
                automatedRoyalties: joi_1.default.boolean()
                    .default(true)
                    .description("If true, royalties will be automatically included."),
                fees: joi_1.default.array()
                    .items(joi_1.default.string().pattern(utils_1.regex.fee))
                    .description("List of fees (formatted as `feeRecipient:feeBps`) to be bundled within the order. Example: `0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00:100`"),
                excludeFlaggedTokens: joi_1.default.boolean()
                    .default(false)
                    .description("If true flagged tokens will be excluded"),
                listingTime: joi_1.default.string()
                    .pattern(utils_1.regex.unixTimestamp)
                    .description("Unix timestamp (seconds) indicating when listing will be listed. Example: `1656080318`"),
                expirationTime: joi_1.default.string()
                    .pattern(utils_1.regex.unixTimestamp)
                    .description("Unix timestamp (seconds) indicating when listing will expire. Example: `1656080318`"),
                salt: joi_1.default.string()
                    .pattern(utils_1.regex.number)
                    .description("Optional. Random string to make the order unique"),
                nonce: joi_1.default.string().pattern(utils_1.regex.number).description("Optional. Set a custom nonce"),
            })
                .or("token", "collection", "tokenSetId")
                .oxor("token", "collection", "tokenSetId")
                .with("attributeValue", "attributeKey")
                .with("attributeKey", "attributeValue")
                .with("attributeKey", "collection")),
        }),
    },
    response: {
        schema: joi_1.default.object({
            steps: joi_1.default.array().items(joi_1.default.object({
                kind: joi_1.default.string().valid("request", "signature", "transaction").required(),
                action: joi_1.default.string().required(),
                description: joi_1.default.string().required(),
                items: joi_1.default.array()
                    .items(joi_1.default.object({
                    status: joi_1.default.string().valid("complete", "incomplete").required(),
                    data: joi_1.default.object(),
                    orderIndex: joi_1.default.number(),
                }))
                    .required(),
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
        const payload = request.payload;
        try {
            const maker = payload.maker;
            const source = payload.source;
            // Set up generic bid steps
            const steps = [
                {
                    action: "Wrapping ETH",
                    description: "We'll ask your approval for converting ETH to WETH. Gas fee required.",
                    kind: "transaction",
                    items: [],
                },
                {
                    action: "Approve WETH contract",
                    description: "We'll ask your approval for the exchange to access your token. This is a one-time only operation per exchange.",
                    kind: "transaction",
                    items: [],
                },
                {
                    action: "Authorize offer",
                    description: "A free off-chain signature to create the offer",
                    kind: "signature",
                    items: [],
                },
            ];
            for (let i = 0; i < payload.params.length; i++) {
                const params = payload.params[i];
                const token = params.token;
                const collection = params.collection;
                const tokenSetId = params.tokenSetId;
                const attributeKey = params.attributeKey;
                const attributeValue = params.attributeValue;
                if (!token) {
                    // TODO: Re-enable collection/attribute bids on external orderbooks
                    if (!["reservoir", "opensea"].includes(params.orderbook)) {
                        throw Boom.badRequest("Only single-token bids are supported on external orderbooks");
                    }
                    else if (params.orderbook === "opensea" && attributeKey && attributeValue) {
                        throw Boom.badRequest("Attribute bids are not supported on `opensea` orderbook");
                    }
                }
                // Handle fees
                // TODO: Refactor the builders to get rid of the separate fee/feeRecipient arrays
                // TODO: Refactor the builders to get rid of the API params naming dependency
                params.fee = [];
                params.feeRecipient = [];
                for (const feeData of (_a = params.fees) !== null && _a !== void 0 ? _a : []) {
                    const [feeRecipient, fee] = feeData.split(":");
                    params.fee.push(fee);
                    params.feeRecipient.push(feeRecipient);
                }
                // TODO: Add support for more ERC20 tokens in the future after it's supported by the indexer
                // Check the maker's Weth/Eth balance
                let wrapEthTx;
                const weth = new Sdk.Common.Helpers.Weth(provider_1.baseProvider, index_1.config.chainId);
                const wethBalance = await weth.getBalance(maker);
                if ((0, utils_1.bn)(wethBalance).lt(params.weiPrice)) {
                    const ethBalance = await provider_1.baseProvider.getBalance(maker);
                    if ((0, utils_1.bn)(wethBalance).add(ethBalance).lt(params.weiPrice)) {
                        throw Boom.badData("Maker does not have sufficient balance");
                    }
                    else {
                        wrapEthTx = weth.depositTransaction(maker, (0, utils_1.bn)(params.weiPrice).sub(wethBalance));
                    }
                }
                switch (params.orderKind) {
                    case "seaport": {
                        if (!["reservoir", "opensea"].includes(params.orderbook)) {
                            throw Boom.badRequest("Only `reservoir` and `opensea` are supported as orderbooks");
                        }
                        let order;
                        if (token) {
                            const [contract, tokenId] = token.split(":");
                            order = await seaportBuyToken.build({
                                ...params,
                                maker,
                                contract,
                                tokenId,
                            });
                        }
                        else if (tokenSetId || (collection && attributeKey && attributeValue)) {
                            order = await seaportBuyAttribute.build({
                                ...params,
                                maker,
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
                                ...params,
                                maker,
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
                        const wethApproval = await weth.getAllowance(maker, conduit);
                        if ((0, utils_1.bn)(wethApproval).lt(order.getMatchingPrice())) {
                            approvalTx = weth.approveTransaction(maker, conduit);
                        }
                        steps[0].items.push({
                            status: !wrapEthTx ? "complete" : "incomplete",
                            data: wrapEthTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: !approvalTx ? "complete" : "incomplete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[2].items.push({
                            status: "incomplete",
                            data: {
                                sign: order.getSignatureData(),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "seaport",
                                            data: {
                                                ...order.params,
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
                                        isNonFlagged: params.excludeFlaggedTokens,
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                        // Go on with the next bid
                        continue;
                    }
                    case "zeroex-v4": {
                        if (!["reservoir"].includes(params.orderbook)) {
                            throw Boom.badRequest("Only `reservoir` is supported as orderbook");
                        }
                        let order;
                        if (token) {
                            const [contract, tokenId] = token.split(":");
                            order = await zeroExV4BuyToken.build({
                                ...params,
                                maker,
                                contract,
                                tokenId,
                            });
                        }
                        else if (tokenSetId || (collection && attributeKey && attributeValue)) {
                            order = await zeroExV4BuyAttribute.build({
                                ...params,
                                maker,
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
                                ...params,
                                maker,
                                collection,
                            });
                        }
                        if (!order) {
                            throw Boom.internal("Failed to generate order");
                        }
                        // Check the maker's approval
                        let approvalTx;
                        const wethApproval = await weth.getAllowance(maker, Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId]);
                        if ((0, utils_1.bn)(wethApproval).lt((0, utils_1.bn)(order.params.erc20TokenAmount).add(order.getFeeAmount()))) {
                            approvalTx = weth.approveTransaction(maker, Sdk.ZeroExV4.Addresses.Exchange[index_1.config.chainId]);
                        }
                        steps[0].items.push({
                            status: !wrapEthTx ? "complete" : "incomplete",
                            data: wrapEthTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: !approvalTx ? "complete" : "incomplete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[2].items.push({
                            status: "incomplete",
                            data: {
                                sign: order.getSignatureData(),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "zeroex-v4",
                                            data: {
                                                ...order.params,
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
                                        isNonFlagged: params.excludeFlaggedTokens,
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                        // Go on with the next bid
                        continue;
                    }
                    case "looks-rare": {
                        if (!["reservoir", "looks-rare"].includes(params.orderbook)) {
                            throw Boom.badRequest("Only `reservoir` and `looks-rare` are supported as orderbooks");
                        }
                        if ((_b = params.fees) === null || _b === void 0 ? void 0 : _b.length) {
                            throw Boom.badRequest("LooksRare does not support custom fees");
                        }
                        if (params.excludeFlaggedTokens) {
                            throw Boom.badRequest("LooksRare does not support token-list bids");
                        }
                        let order;
                        if (token) {
                            const [contract, tokenId] = token.split(":");
                            order = await looksRareBuyToken.build({
                                ...params,
                                maker,
                                contract,
                                tokenId,
                            });
                        }
                        else if (collection && !attributeKey && !attributeValue) {
                            order = await looksRareBuyCollection.build({
                                ...params,
                                maker,
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
                        const wethApproval = await weth.getAllowance(maker, Sdk.LooksRare.Addresses.Exchange[index_1.config.chainId]);
                        if ((0, utils_1.bn)(wethApproval).lt((0, utils_1.bn)(order.params.price))) {
                            approvalTx = weth.approveTransaction(maker, Sdk.LooksRare.Addresses.Exchange[index_1.config.chainId]);
                        }
                        steps[0].items.push({
                            status: !wrapEthTx ? "complete" : "incomplete",
                            data: wrapEthTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: !approvalTx ? "complete" : "incomplete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[2].items.push({
                            status: "incomplete",
                            data: {
                                sign: order.getSignatureData(),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "looks-rare",
                                            data: {
                                                ...order.params,
                                            },
                                        },
                                        tokenSetId,
                                        collection: collection && !attributeKey && !attributeValue ? collection : undefined,
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                        // Go on with the next bid
                        continue;
                    }
                    case "x2y2": {
                        if (!["x2y2"].includes(params.orderbook)) {
                            throw Boom.badRequest("Only `x2y2` is supported as orderbook");
                        }
                        if ((_c = params.fees) === null || _c === void 0 ? void 0 : _c.length) {
                            throw Boom.badRequest("X2Y2 does not support explicit fees");
                        }
                        if (params.excludeFlaggedTokens) {
                            throw Boom.badRequest("X2Y2 does not support token-list bids");
                        }
                        let order;
                        if (token) {
                            const [contract, tokenId] = token.split(":");
                            order = await x2y2BuyToken.build({
                                ...params,
                                maker,
                                contract,
                                tokenId,
                            });
                        }
                        else if (collection && !attributeKey && !attributeValue) {
                            order = await x2y2BuyCollection.build({
                                ...params,
                                maker,
                                collection,
                            });
                        }
                        else {
                            throw Boom.badRequest("X2Y2 only supports single-token or collection-wide bids");
                        }
                        if (!order) {
                            throw Boom.internal("Failed to generate order");
                        }
                        const upstreamOrder = Sdk.X2Y2.Order.fromLocalOrder(index_1.config.chainId, order);
                        // Check the maker's approval
                        let approvalTx;
                        const wethApproval = await weth.getAllowance(maker, Sdk.X2Y2.Addresses.Exchange[index_1.config.chainId]);
                        if ((0, utils_1.bn)(wethApproval).lt((0, utils_1.bn)(upstreamOrder.params.price))) {
                            approvalTx = weth.approveTransaction(maker, Sdk.X2Y2.Addresses.Exchange[index_1.config.chainId]);
                        }
                        steps[0].items.push({
                            status: !wrapEthTx ? "complete" : "incomplete",
                            data: wrapEthTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: !approvalTx ? "complete" : "incomplete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[2].items.push({
                            status: "incomplete",
                            data: {
                                sign: new Sdk.X2Y2.Exchange(index_1.config.chainId, index_1.config.x2y2ApiKey).getOrderSignatureData(order),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "x2y2",
                                            data: {
                                                ...order,
                                            },
                                        },
                                        tokenSetId,
                                        collection: collection && !attributeKey && !attributeValue ? collection : undefined,
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                        // Go on with the next bid
                        continue;
                    }
                    case "universe": {
                        if (!["universe"].includes(params.orderbook)) {
                            throw Boom.badRequest("Only `universe` is supported as orderbook");
                        }
                        let order;
                        if (token) {
                            const [contract, tokenId] = token.split(":");
                            order = await universeBuyToken.build({
                                ...params,
                                maker,
                                contract,
                                tokenId,
                                // This should change after bids support more ERC20 tokens
                                currency: Sdk.Common.Addresses.Weth[index_1.config.chainId],
                            });
                        }
                        if (!order) {
                            throw Boom.internal("Failed to generate order");
                        }
                        // Check the maker's approval
                        let approvalTx;
                        const wethApproval = await weth.getAllowance(maker, Sdk.Universe.Addresses.Exchange[index_1.config.chainId]);
                        if ((0, utils_1.bn)(wethApproval).lt((0, utils_1.bn)(order.params.make.value))) {
                            approvalTx = weth.approveTransaction(maker, Sdk.Universe.Addresses.Exchange[index_1.config.chainId]);
                        }
                        steps[0].items.push({
                            status: !wrapEthTx ? "complete" : "incomplete",
                            data: wrapEthTx,
                            orderIndex: i,
                        });
                        steps[1].items.push({
                            status: !approvalTx ? "complete" : "incomplete",
                            data: approvalTx,
                            orderIndex: i,
                        });
                        steps[2].items.push({
                            status: "incomplete",
                            data: {
                                sign: order.getSignatureData(),
                                post: {
                                    endpoint: "/order/v3",
                                    method: "POST",
                                    body: {
                                        order: {
                                            kind: "universe",
                                            data: {
                                                ...order.params,
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
                                        collection: collection && params.excludeFlaggedTokens && !attributeKey && !attributeValue
                                            ? collection
                                            : undefined,
                                        isNonFlagged: params.excludeFlaggedTokens,
                                        orderbook: params.orderbook,
                                        source,
                                    },
                                },
                            },
                            orderIndex: i,
                        });
                        // Go on with the next bid
                        continue;
                    }
                }
            }
            // We should only have a single ETH wrapping transaction
            if (steps[0].items.length > 1) {
                let amount = (0, utils_1.bn)(0);
                for (let i = 0; i < steps[0].items.length; i++) {
                    const itemAmount = (0, utils_1.bn)(((_d = steps[0].items[i].data) === null || _d === void 0 ? void 0 : _d.value) || 0);
                    if (itemAmount.gt(amount)) {
                        amount = itemAmount;
                    }
                }
                if (amount.gt(0)) {
                    const weth = new Sdk.Common.Helpers.Weth(provider_1.baseProvider, index_1.config.chainId);
                    const wethWrapTx = weth.depositTransaction(maker, amount);
                    steps[0].items = [
                        {
                            status: "incomplete",
                            data: wethWrapTx,
                        },
                    ];
                }
                else {
                    steps[0].items = [];
                }
            }
            // De-duplicate step items
            for (const step of steps) {
                // Assume `JSON.stringify` is deterministic
                const uniqueItems = lodash_1.default.uniqBy(step.items, ({ data }) => JSON.stringify(data));
                if (step.items.length > uniqueItems.length) {
                    step.items = uniqueItems.map((item) => ({
                        status: item.status,
                        data: item.data,
                        orderIndex: item.orderIndex,
                    }));
                }
            }
            return { steps };
        }
        catch (error) {
            logger_1.logger.error(`get-execute-bid-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v4.js.map