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
Object.defineProperty(exports, "__esModule", { value: true });
exports.postOrder = exports.RATE_LIMIT_INTERVAL = exports.RATE_LIMIT_REQUEST_COUNT = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
// X2Y2 default rate limit - 120 requests per minute
exports.RATE_LIMIT_REQUEST_COUNT = 120;
exports.RATE_LIMIT_INTERVAL = 1000 * 60;
const postOrder = async (order, apiKey) => {
    const exchange = new Sdk.X2Y2.Exchange(index_1.config.chainId, apiKey);
    // When lowering the price of an existing listing, X2Y2 requires
    // passing the order id of the previous listing, so here we have
    // this check in place so that we can cover such scenarios.
    let orderId;
    const upstreamOrder = Sdk.X2Y2.Order.fromLocalOrder(index_1.config.chainId, order);
    if (upstreamOrder.params.type === "sell") {
        const activeOrder = await db_1.redb.oneOrNone(`
        SELECT
          (orders.raw_data ->> 'id')::INT AS id
        FROM orders
        WHERE orders.token_set_id = $/tokenSetId/
          AND orders.fillability_status = 'fillable'
          AND orders.approval_status = 'approved'
          AND orders.side = 'sell'
          AND orders.maker = $/maker/
          AND orders.kind = 'x2y2'
        LIMIT 1
      `, {
            tokenSetId: `token:${upstreamOrder.params.nft.token}:${upstreamOrder.params.nft.tokenId}`.toLowerCase(),
            maker: (0, utils_1.toBuffer)(upstreamOrder.params.maker),
        });
        if (activeOrder === null || activeOrder === void 0 ? void 0 : activeOrder.id) {
            orderId = activeOrder.id;
        }
    }
    await exchange.postOrder(order, orderId).catch((error) => {
        if (error.response) {
            logger_1.logger.error("X2Y2_ORDERBOOK_API", `Failed to post order to X2Y2. order=${JSON.stringify(order)}, status: ${error.response.status}, data:${JSON.stringify(error.response.data)}`);
        }
        throw new Error("Failed to post order to X2Y2");
    });
};
exports.postOrder = postOrder;
//# sourceMappingURL=index.js.map