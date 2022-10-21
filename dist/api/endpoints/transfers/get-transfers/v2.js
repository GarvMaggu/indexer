"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransfersV2Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const assets_1 = require("@/utils/assets");
const version = "v2";
exports.getTransfersV2Options = {
    description: "Historical token transfers",
    notes: "Get recent transfers for a contract or token.",
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
                .description("Filter to a particular contract, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.token)
                .description("Filter to a particular token, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            collection: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection, e.g. `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            attributes: joi_1.default.object()
                .unknown()
                .description("Filter to a particular attribute, e.g. `attributes[Type]=Original`"),
            limit: joi_1.default.number().integer().min(1).max(100).default(20),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64),
        })
            .oxor("contract", "token", "collection")
            .or("contract", "token", "collection")
            .with("attributes", "collection"),
    },
    response: {
        schema: joi_1.default.object({
            transfers: joi_1.default.array().items(joi_1.default.object({
                token: joi_1.default.object({
                    contract: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                    tokenId: joi_1.default.string().pattern(utils_1.regex.number),
                    name: joi_1.default.string().allow(null, ""),
                    image: joi_1.default.string().allow(null, ""),
                    collection: joi_1.default.object({
                        id: joi_1.default.string().allow(null),
                        name: joi_1.default.string().allow(null, ""),
                    }),
                }),
                from: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                to: joi_1.default.string().lowercase().pattern(utils_1.regex.address),
                amount: joi_1.default.string(),
                txHash: joi_1.default.string().lowercase().pattern(utils_1.regex.bytes32),
                block: joi_1.default.number(),
                logIndex: joi_1.default.number(),
                batchIndex: joi_1.default.number(),
                timestamp: joi_1.default.number(),
                price: joi_1.default.number().unsafe().allow(null),
            })),
            continuation: joi_1.default.string().pattern(utils_1.regex.base64).allow(null),
        }).label(`getTransfers${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-transfers-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        try {
            // Associating sales to transfers is done by searching for transfer
            // and sale events that occurred close to each other. In most cases
            // we will first have the transfer followed by the sale but we have
            // some exceptions.
            let baseQuery = `
        SELECT
          nft_transfer_events.address,
          nft_transfer_events.token_id,
          tokens.name,
          tokens.image,
          tokens.collection_id,
          collections.name as collection_name,
          nft_transfer_events.from,
          nft_transfer_events.to,
          nft_transfer_events.amount,
          nft_transfer_events.tx_hash,
          nft_transfer_events.timestamp,
          nft_transfer_events.block,
          nft_transfer_events.log_index,
          nft_transfer_events.batch_index,
          (
            SELECT fill_events_2.price
            FROM fill_events_2
            WHERE fill_events_2.tx_hash = nft_transfer_events.tx_hash
              AND fill_events_2.log_index = nft_transfer_events.log_index + (
                CASE
                  WHEN fill_events_2.order_kind = 'x2y2' THEN 2
                  WHEN fill_events_2.order_kind = 'seaport' THEN -2
                  ELSE 1
                END
              )
            LIMIT 1
          ) AS price
        FROM nft_transfer_events
        JOIN tokens
          ON nft_transfer_events.address = tokens.contract
          AND nft_transfer_events.token_id = tokens.token_id
        JOIN collections
          ON tokens.collection_id = collections.id
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
            if (query.collection) {
                if (query.attributes) {
                    const attributes = [];
                    Object.entries(query.attributes).forEach(([key, values]) => {
                        (Array.isArray(values) ? values : [values]).forEach((value) => attributes.push({ key, value }));
                    });
                    for (let i = 0; i < attributes.length; i++) {
                        query[`key${i}`] = attributes[i].key;
                        query[`value${i}`] = attributes[i].value;
                        baseQuery += `
              JOIN token_attributes ta${i}
                ON nft_transfer_events.address = ta${i}.contract
                AND nft_transfer_events.token_id = ta${i}.token_id
                AND ta${i}.key = $/key${i}/
                AND ta${i}.value = $/value${i}/
            `;
                    }
                }
                if (query.collection.match(/^0x[a-f0-9]{40}:\d+:\d+$/g)) {
                    const [contract, startTokenId, endTokenId] = query.collection.split(":");
                    query.contract = (0, utils_1.toBuffer)(contract);
                    query.startTokenId = startTokenId;
                    query.endTokenId = endTokenId;
                    conditions.push(`nft_transfer_events.address = $/contract/`);
                    conditions.push(`nft_transfer_events.token_id >= $/startTokenId/`);
                    conditions.push(`nft_transfer_events.token_id <= $/endTokenId/`);
                }
                else {
                    query.contract = (0, utils_1.toBuffer)(query.collection);
                    conditions.push(`nft_transfer_events.address = $/contract/`);
                }
            }
            if (query.continuation) {
                const [timestamp, logIndex, batchIndex] = (0, utils_1.splitContinuation)(query.continuation, /^(\d+)_(\d+)_(\d+)$/);
                query.timestamp = timestamp;
                query.logIndex = logIndex;
                query.batchIndex = batchIndex;
                conditions.push(`(nft_transfer_events.timestamp, nft_transfer_events.log_index, nft_transfer_events.batch_index) < ($/timestamp/, $/logIndex/, $/batchIndex/)`);
            }
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
                token: {
                    contract: (0, utils_1.fromBuffer)(r.address),
                    tokenId: r.token_id,
                    name: r.name,
                    image: assets_1.Assets.getLocalAssetsLink(r.image),
                    collection: {
                        id: r.collection_id,
                        name: r.collection_name,
                    },
                },
                from: (0, utils_1.fromBuffer)(r.from),
                to: (0, utils_1.fromBuffer)(r.to),
                amount: String(r.amount),
                block: r.block,
                txHash: (0, utils_1.fromBuffer)(r.tx_hash),
                logIndex: r.log_index,
                batchIndex: r.batch_index,
                timestamp: r.timestamp,
                price: r.price ? (0, utils_1.formatEth)(r.price) : null,
            }));
            return {
                transfers: result,
                continuation,
            };
        }
        catch (error) {
            logger_1.logger.error(`get-transfers-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map