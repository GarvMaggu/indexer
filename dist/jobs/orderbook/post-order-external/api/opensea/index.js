"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCollectionOffer = exports.buildCollectionOffer = exports.postOrder = exports.RATE_LIMIT_INTERVAL = exports.RATE_LIMIT_REQUEST_COUNT = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const errors_1 = require("@/jobs/orderbook/post-order-external/api/errors");
// Open Sea default rate limit - 2 requests per second for post apis
exports.RATE_LIMIT_REQUEST_COUNT = 2;
exports.RATE_LIMIT_INTERVAL = 1000;
const postOrder = async (order, apiKey) => {
    var _a;
    const url = `https://${index_1.config.chainId === 5 ? "testnets-api." : "api."}opensea.io/v2/orders/${index_1.config.chainId === 5 ? "goerli" : "ethereum"}/seaport/${((_a = order.getInfo()) === null || _a === void 0 ? void 0 : _a.side) === "sell" ? "listings" : "offers"}`;
    await axios_1.default
        .post(url, JSON.stringify({
        parameters: {
            ...order.params,
            totalOriginalConsiderationItems: order.params.consideration.length,
        },
        signature: order.params.signature,
    }), {
        headers: index_1.config.chainId === 1
            ? {
                "Content-Type": "application/json",
                "X-Api-Key": apiKey || index_1.config.openSeaApiKey,
            }
            : {
                "Content-Type": "application/json",
                // The request will fail if passing the API key on Rinkeby
            },
    })
        .catch((error) => {
        if (error.response) {
            logger_1.logger.error("OPENSEA_ORDERBOOK_API", `Failed to post order to OpenSea. order=${JSON.stringify(order)}, status: ${error.response.status}, data:${JSON.stringify(error.response.data)}`);
            handleErrorResponse(error.response);
        }
        throw new Error(`Failed to post order to OpenSea`);
    });
};
exports.postOrder = postOrder;
const buildCollectionOffer = async (offerer, quantity, collectionSlug, apiKey) => {
    const url = `https://${index_1.config.chainId === 5 ? "testnets-api." : "api."}opensea.io/v2/offers/build`;
    return (axios_1.default
        .post(url, JSON.stringify({
        offerer,
        quantity,
        criteria: {
            collection: {
                slug: collectionSlug,
            },
        },
    }), {
        headers: index_1.config.chainId === 1
            ? {
                "Content-Type": "application/json",
                "X-Api-Key": apiKey || index_1.config.openSeaApiKey,
            }
            : {
                "Content-Type": "application/json",
                // The request will fail if passing the API key on Rinkeby
            },
    })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((response) => response.data)
        .catch((error) => {
        logger_1.logger.error("OPENSEA_ORDERBOOK_API", `Build OpenSea collection offer error. offerer=${offerer}, quantity=${quantity}, collectionSlug=${collectionSlug}, error=${error}`);
        if (error.response) {
            logger_1.logger.error("OPENSEA_ORDERBOOK_API", `Failed to build OpenSea collection offer. offerer=${offerer}, quantity=${quantity}, collectionSlug=${collectionSlug}, status: ${error.response.status}, data:${JSON.stringify(error.response.data)}`);
            handleErrorResponse(error.response);
        }
        throw new Error(`Failed to build OpenSea collection offer`);
    }));
};
exports.buildCollectionOffer = buildCollectionOffer;
const postCollectionOffer = async (order, collectionSlug, apiKey) => {
    const url = `https://${index_1.config.chainId === 5 ? "testnets-api." : "api."}opensea.io/v2/offers`;
    const data = {
        criteria: {
            collection: {
                slug: collectionSlug,
            },
        },
        protocol_data: {
            parameters: {
                ...order.params,
                totalOriginalConsiderationItems: order.params.consideration.length,
            },
            signature: order.params.signature,
        },
    };
    await axios_1.default
        .post(url, data, {
        headers: index_1.config.chainId === 1
            ? {
                "Content-Type": "application/json",
                "X-Api-Key": apiKey || index_1.config.openSeaApiKey,
            }
            : {
                "Content-Type": "application/json",
                // The request will fail if passing the API key on Rinkeby
            },
    })
        .catch((error) => {
        logger_1.logger.error("OPENSEA_ORDERBOOK_API", `Post OpenSea collection offer error. order=${JSON.stringify(order)}, collectionSlug=${collectionSlug}, url=${url}, data=${data}, error=${error}`);
        if (error.response) {
            logger_1.logger.error("OPENSEA_ORDERBOOK_API", `Failed to post offer to OpenSea. order=${JSON.stringify(order)}, collectionSlug=${collectionSlug}, url=${url}, data=${data}, status: ${error.response.status}, data:${JSON.stringify(error.response.data)}`);
            handleErrorResponse(error.response);
        }
        throw new Error(`Failed to post offer to OpenSea`);
    });
};
exports.postCollectionOffer = postCollectionOffer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleErrorResponse = (response) => {
    var _a;
    switch (response.status) {
        case 429: {
            let delay = exports.RATE_LIMIT_INTERVAL;
            if ((_a = response.data.detail) === null || _a === void 0 ? void 0 : _a.startsWith("Request was throttled. Expected available in")) {
                try {
                    delay = response.data.detail.split(" ")[6] * 1000;
                }
                catch {
                    // Skip on any errors
                }
            }
            throw new errors_1.RequestWasThrottledError("Request was throttled by OpenSea", delay);
        }
        case 400:
            throw new errors_1.InvalidRequestError("Request was rejected by OpenSea");
    }
};
//# sourceMappingURL=index.js.map