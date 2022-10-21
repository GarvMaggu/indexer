"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postOrder = exports.RATE_LIMIT_INTERVAL = exports.RATE_LIMIT_REQUEST_COUNT = void 0;
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const axios_1 = __importDefault(require("axios"));
const errors_1 = require("@/jobs/orderbook/post-order-external/api/errors");
// Universe default rate limit - 120 requests per minute
exports.RATE_LIMIT_REQUEST_COUNT = 120;
exports.RATE_LIMIT_INTERVAL = 1000 * 60;
const postOrder = async (order) => {
    const apiOrder = JSON.parse(JSON.stringify(order));
    delete apiOrder.params.kind;
    await axios_1.default
        .post(`https://${index_1.config.chainId === 4 ? "dev.marketplace-api." : "prod-marketplace"}.universe.xyz/v1/orders/order`, JSON.stringify(apiOrder.params), {
        headers: {
            "Content-Type": "application/json",
        },
    })
        .catch((error) => {
        if (error.response) {
            logger_1.logger.error("UNIVERSE_ORDERBOOK_API", `Failed to post order to Universe. order=${JSON.stringify(order)}, status: ${error.response.status}, data:${JSON.stringify(error.response.data)}`);
            switch (error.response.status) {
                case 400:
                case 401:
                    throw new errors_1.InvalidRequestError("Request was rejected by Universe");
            }
        }
        throw new Error(`Failed to post order to Universe`);
    });
};
exports.postOrder = postOrder;
//# sourceMappingURL=index.js.map