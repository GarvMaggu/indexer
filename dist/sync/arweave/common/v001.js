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
exports.processTransactionData = void 0;
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const orderbookOrders = __importStar(require("@/jobs/orderbook/orders-queue"));
const orderbookTokenSets = __importStar(require("@/jobs/orderbook/token-sets-queue"));
// Version 0.0.1 of Reservoir Protocol Arweave data:
// - `wyvern-v2` legacy orders (decomissioned, not supported anymore)
// - `wyvern-v2.3` legacy orders (decomissioned, not supported anymore)
// - `looks-rare` orders
// - `opendao` orders (decomissioned, not supported anymore)
// - `zeroex-v4` orders
// - `seaport` orders
// - `list` token sets
const processTransactionData = async (
// eslint-disable-next-line @typescript-eslint/no-explicit-any
transactionData) => {
    const orderInfos = [];
    const tokenSets = [];
    for (const { kind, data } of transactionData) {
        try {
            switch (kind) {
                case "looks-rare":
                case "seaport":
                case "zeroex-v4": {
                    orderInfos.push({
                        kind,
                        info: {
                            orderParams: data,
                            metadata: {
                                schemaHash: data.schemaHash,
                            },
                        },
                    });
                    break;
                }
                case "token-set": {
                    tokenSets.push({
                        id: data.id,
                        schemaHash: data.schemaHash,
                        schema: data.schema,
                        items: {
                            contract: data.contract,
                            tokenIds: data.tokenIds,
                        },
                    });
                    break;
                }
            }
        }
        catch {
            // Ignore any errors
        }
    }
    if (!index_1.config.disableOrders) {
        await Promise.all([
            orderbookOrders.addToQueue(orderInfos),
            orderbookTokenSets.addToQueue(tokenSets),
        ]);
        logger_1.logger.info("process-tranaction-data-v0.0.1", `Got ${orderInfos.length} orders from Arweave`);
        logger_1.logger.info("process-tranaction-data-v0.0.1", `Got ${tokenSets.length} token sets from Arweave`);
    }
};
exports.processTransactionData = processTransactionData;
//# sourceMappingURL=v001.js.map