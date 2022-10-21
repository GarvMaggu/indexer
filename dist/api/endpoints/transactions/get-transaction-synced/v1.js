"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionSyncedV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getTransactionSyncedV1Options = {
    description: "Transaction status",
    notes: "Get a boolean response on whether a particular transaction was synced or not.",
    tags: ["api", "Orderbook"],
    plugins: {
        "hapi-swagger": {
            order: 10,
        },
    },
    validate: {
        params: joi_1.default.object({
            txHash: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{64}$/)
                .required(),
        }),
    },
    response: {
        schema: joi_1.default.object({
            synced: joi_1.default.boolean().required(),
        }).label(`getTransactionSynced${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-transaction-synced-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const params = request.params;
        const result = await db_1.idb.oneOrNone(`
        SELECT 1 FROM transactions
        WHERE transactions.hash = $/txHash/
      `, { txHash: (0, utils_1.toBuffer)(params.txHash) });
        if (result) {
            return { synced: true };
        }
        else {
            return { synced: false };
        }
    },
};
//# sourceMappingURL=v1.js.map