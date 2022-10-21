"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransfersBulkV1Options = void 0;
const crypto_1 = __importDefault(require("crypto"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getTransfersBulkV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 5000,
    },
    description: "Bulk historical transfers",
    notes: "Note: this API is optimized for bulk access, and offers minimal filters/metadata. If you need more flexibility, try the `NFT API > Transfers` endpoint",
    tags: ["api", "Transfers"],
    plugins: {
        "hapi-swagger": {
            order: 10,
        },
    },
    validate: {
        query: joi_1.default.object({
            contract: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Filter to a particular contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            startTimestamp: joi_1.default.number().description("Get events after a particular unix timestamp (inclusive)"),
            endTimestamp: joi_1.default.number().description("Get events before a particular unix timestamp (inclusive)"),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(1000)
                .default(100)
                .description("Amount of items returned in response."),
            continuation: joi_1.default.string()
                .pattern(utils_1.regex.base64)
                .description("Use continuation token to request next offset of items."),
        }),
    },
    response: {
        schema: joi_1.default.object({
            transfers: joi_1.default.array().items(joi_1.default.object({
                id: joi_1.default.string(),
                token: joi_1.default.object({
                    contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                    tokenId: joi_1.default.string().pattern(utils_1.regex.number),
                }),
                from: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                to: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                amount: joi_1.default.string(),
                block: joi_1.default.number(),
                txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32),
                logIndex: joi_1.default.number(),
                batchIndex: joi_1.default.number(),
                timestamp: joi_1.default.number(),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getTransfersBulk${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-transfers-bulk-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            let baseQuery = `
        SELECT
          nft_transfer_events.address,
          nft_transfer_events.token_id,
          nft_transfer_events.from,
          nft_transfer_events.to,
          nft_transfer_events.amount,
          nft_transfer_events.tx_hash,
          nft_transfer_events.timestamp,
          nft_transfer_events.block,
          nft_transfer_events.log_index,
          nft_transfer_events.batch_index
        FROM nft_transfer_events
      `;
            // Filters
            const conditions = [];
            if (query.contract) {
                query.contract = (0, utils_1.toBuffer)(query.contract);
                conditions.push(`nft_transfer_events.address = $/contract/`);
            }
            if (query.token) {
                const [contract, tokenId] = query.token.split(":");
                query.contract = (0, utils_1.toBuffer)(contract);
                query.tokenId = tokenId;
                conditions.push(`nft_transfer_events.address = $/contract/`);
                conditions.push(`nft_transfer_events.token_id = $/tokenId/`);
            }
            if (query.continuation) {
                const [timestamp, logIndex, batchIndex] = (0, utils_1.splitContinuation)(query.continuation, /^(\d+)_(\d+)_(\d+)$/);
                query.timestamp = timestamp;
                query.logIndex = logIndex;
                query.batchIndex = batchIndex;
                conditions.push(`(nft_transfer_events.timestamp, nft_transfer_events.log_index, nft_transfer_events.batch_index) < ($/timestamp/, $/logIndex/, $/batchIndex/)`);
            }
            // We default in the code so that these values don't appear in the docs
            if (!query.startTimestamp) {
                query.startTimestamp = 0;
            }
            if (!query.endTimestamp) {
                query.endTimestamp = 9999999999;
            }
            conditions.push(`
        (nft_transfer_events.timestamp >= $/startTimestamp/ AND
        nft_transfer_events.timestamp <= $/endTimestamp/)
      `);
            if (conditions.length) {
                baseQuery += " WHERE " + conditions.map((c) => `(${c})`).join(" AND ");
            }
            // Sorting
            baseQuery += `
        ORDER BY
          nft_transfer_events.timestamp DESC,
          nft_transfer_events.log_index DESC,
          nft_transfer_events.batch_index DESC
      `;
            // Pagination
            baseQuery += ` LIMIT $/limit/`;
            const rawResult = await db_1.redb.manyOrNone(baseQuery, query);
            let continuation = null;
            if (rawResult.length === query.limit) {
                continuation = (0, utils_1.buildContinuation)(rawResult[rawResult.length - 1].timestamp +
                    "_" +
                    rawResult[rawResult.length - 1].log_index +
                    "_" +
                    rawResult[rawResult.length - 1].batch_index);
            }
            const result = rawResult.map((r) => ({
                id: crypto_1.default
                    .createHash("sha256")
                    .update(`${(0, utils_1.fromBuffer)(r.tx_hash)}${r.log_index}${r.batch_index}`)
                    .digest("hex"),
                token: {
                    contract: (0, utils_1.fromBuffer)(r.address),
                    tokenId: r.token_id,
                },
                from: (0, utils_1.fromBuffer)(r.from),
                to: (0, utils_1.fromBuffer)(r.to),
                amount: String(r.amount),
                block: r.block,
                txHash: (0, utils_1.fromBuffer)(r.tx_hash),
                logIndex: r.log_index,
                batchIndex: r.batch_index,
                timestamp: r.timestamp,
            }));
            return {
                transfers: result,
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-transfers-bulk-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map