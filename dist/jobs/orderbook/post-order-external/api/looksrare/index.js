"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postOrder = exports.RATE_LIMIT_INTERVAL = exports.RATE_LIMIT_REQUEST_COUNT = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const errors_1 = require("@/jobs/orderbook/post-order-external/api/errors");
const bytes_1 = require("@ethersproject/bytes");
// Looks Rare default rate limit - 120 requests per minute
exports.RATE_LIMIT_REQUEST_COUNT = 120;
exports.RATE_LIMIT_INTERVAL = 1000 * 60;
const postOrder = async (order, apiKey) => {
    const lrOrder = {
        ...order.params,
        signature: (0, bytes_1.joinSignature)({
            v: order.params.v,
            r: order.params.r,
            s: order.params.s,
        }),
        tokenId: order.params.kind === "single-token" ? order.params.tokenId : null,
        // For now, no order kinds have any additional params
        params: [],
    };
    await axios_1.default
        .post(`https://${index_1.config.chainId === 5 ? "api-goerli." : "api."}looksrare.org/api/v1/orders`, JSON.stringify(lrOrder), {
        headers: index_1.config.chainId === 1
            ? {
                "Content-Type": "application/json",
                "X-Looks-Api-Key": apiKey || index_1.config.looksRareApiKey,
            }
            : {
                "Content-Type": "application/json",
            },
    })
        .catch((error) => {
        if (error.response) {
            logger_1.logger.error("LOOKSRARE_ORDERBOOK_API", `Failed to post order to LooksRare. order=${JSON.stringify(order)}, status: ${error.response.status}, data:${JSON.stringify(error.response.data)}`);
            switch (error.response.status) {
                case 429: {
                    throw new errors_1.RequestWasThrottledError("Request was throttled by LooksRare", exports.RATE_LIMIT_INTERVAL);
                }
                case 400:
                case 401:
                    throw new errors_1.InvalidRequestError("Request was rejected by LooksRare");
            }
        }
        throw new Error(`Failed to post order to LooksRare`);
    });
};
exports.postOrder = postOrder;
//# sourceMappingURL=index.js.map