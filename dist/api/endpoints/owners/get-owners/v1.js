"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOwnersV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const collection_sets_1 = require("@/models/collection-sets");
const version = "v1";
exports.getOwnersV1Options = {
    cache: {
        privacy: "public",
        expiresIn: 60 * 60 * 1000,
    },
    description: "Owners",
    notes: "Get owners with various filters applied, and a summary of their ownership. Useful for exploring top owners in a collection or attribute.",
    tags: ["api", "Owners"],
    plugins: {
        "hapi-swagger": {
            order: 6,
        },
    },
    validate: {
        query: joi_1.default.object({
            collectionsSetId: joi_1.default.string()
                .lowercase()
                .description("Filter to a particular collection set."),
            collection: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+:[0-9]+$|^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular collection with collection-id. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            contract: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}$/)
                .description("Filter to a particular contract. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`"),
            token: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+$/)
                .description("Filter to a particular token. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63:123`"),
            attributes: joi_1.default.object()
                .unknown()
                .description("Filter to a particular attribute. Example: `attributes[Type]=Original`"),
            offset: joi_1.default.number()
                .integer()
                .min(0)
                .default(0)
                .description("Use offset to request the next batch of items."),
            limit: joi_1.default.number()
                .integer()
                .min(1)
                .max(500)
                .default(20)
                .description("Amount of items returned in response."),
        })
            .oxor("collectionsSetId", "collection", "contract", "token")
            .or("collectionsSetId", "collection", "contract", "token")
            .without("attributes", ["token", "contract"]),
    },
    response: {
        schema: joi_1.default.object({
            owners: joi_1.default.array().items(joi_1.default.object({
                address: joi_1.default.string(),
                ownership: joi_1.default.object({
                    tokenCount: joi_1.default.string(),
                    onSaleCount: joi_1.default.string(),
                    floorAskPrice: joi_1.default.number().unsafe().allow(null),
                    topBidValue: joi_1.default.number().unsafe().allow(null),
                    totalBidValue: joi_1.default.number().unsafe().allow(null),
                }),
            })),
        }).label(`getOwners${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-owners-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        let nftBalancesFilter = "";
        let tokensFilter = "";
        let attributesJoin = "";
        if (query.collection) {
            if (query.attributes) {
                const attributes = [];
                Object.entries(query.attributes).forEach(([key, values]) => {
                    (Array.isArray(values) ? values : [values]).forEach((value) => attributes.push({ key, value }));
                });
                for (let i = 0; i < attributes.length; i++) {
                    query[`key${i}`] = attributes[i].key;
                    query[`value${i}`] = attributes[i].value;
                    attributesJoin += `
            JOIN token_attributes ta${i}
              ON nft_balances.contract = ta${i}.contract
              AND nft_balances.token_id = ta${i}.token_id
              AND ta${i}.key = $/key${i}/
              AND ta${i}.value = $/value${i}/
          `;
                }
            }
            // If the collection passed is identical the contract
            if (/^0x[a-f0-9]{40}$/.test(query.collection)) {
                query.contract = (0, utils_1.toBuffer)(query.collection);
                nftBalancesFilter = `nft_balances.contract = $/contract/`;
                tokensFilter = `tokens.contract = $/contract/`;
            }
            else {
                // This is a range collection
                const [contract, startTokenId, endTokenId] = query.collection.split(":");
                query.contract = (0, utils_1.toBuffer)(contract);
                query.startTokenId = startTokenId;
                query.endTokenId = endTokenId;
                nftBalancesFilter = `nft_balances.contract = $/contract/ AND nft_balances.token_id BETWEEN $/startTokenId/ AND $/endTokenId/`;
                tokensFilter = `tokens.contract = $/contract/ AND tokens.token_id BETWEEN $/startTokenId/ AND $/endTokenId/`;
            }
        }
        else if (query.contract) {
            query.contract = (0, utils_1.toBuffer)(query.contract);
            nftBalancesFilter = `nft_balances.contract = $/contract/`;
            tokensFilter = `tokens.contract = $/contract/`;
        }
        else if (query.token) {
            const [contract, tokenId] = query.token.split(":");
            query.contract = (0, utils_1.toBuffer)(contract);
            query.tokenId = tokenId;
            nftBalancesFilter = `nft_balances.contract = $/contract/ AND nft_balances.token_id = $/tokenId/`;
            tokensFilter = `tokens.contract = $/contract/ AND tokens.token_id = $/tokenId/`;
        }
        else if (query.collectionsSetId) {
            let i = 0;
            const addCollectionToFilter = (id) => {
                ++i;
                query[`contract${i}`] = (0, utils_1.toBuffer)(id);
                nftBalancesFilter = `${nftBalancesFilter}$/contract${i}/, `;
                tokensFilter = `${tokensFilter}$/contract${i}/, `;
            };
            await collection_sets_1.CollectionSets.getCollectionsIds(query.collectionsSetId).then((result) => result.forEach(addCollectionToFilter));
            if (!nftBalancesFilter && !tokensFilter) {
                return { owners: [] };
            }
            nftBalancesFilter = `nft_balances.contract IN (${nftBalancesFilter.substring(0, nftBalancesFilter.lastIndexOf(", "))})`;
            tokensFilter = `tokens.contract IN (${tokensFilter.substring(0, tokensFilter.lastIndexOf(", "))})`;
        }
        try {
            const baseQuery = `
        WITH x AS (
          SELECT owner, SUM(amount) AS token_count
          FROM nft_balances
          ${attributesJoin}
          WHERE ${nftBalancesFilter}
          AND amount > 0
          GROUP BY owner
          ORDER BY token_count DESC, owner
          OFFSET ${query.offset} LIMIT ${query.limit}
        )
        SELECT 
          nft_balances.owner,
          SUM(nft_balances.amount) AS token_count,
          COUNT(*) FILTER (WHERE tokens.floor_sell_value IS NOT NULL) AS on_sale_count,
          MIN(tokens.floor_sell_value) AS floor_sell_value,
          MAX(tokens.top_buy_value) AS top_buy_value,
          SUM(nft_balances.amount) * MAX(tokens.top_buy_value) AS total_buy_value
        FROM nft_balances
        JOIN tokens ON nft_balances.contract = tokens.contract AND nft_balances.token_id = tokens.token_id
        ${attributesJoin}
        WHERE ${tokensFilter}
        AND nft_balances.owner IN (SELECT owner FROM x)
        AND nft_balances.amount > 0
        GROUP BY nft_balances.owner
        ORDER BY token_count DESC, nft_balances.owner
      `;
            const result = await db_1.redb.manyOrNone(baseQuery, query).then((result) => result.map((r) => ({
                address: (0, utils_1.fromBuffer)(r.owner),
                ownership: {
                    tokenCount: String(r.token_count),
                    onSaleCount: String(r.on_sale_count),
                    floorAskPrice: r.floor_sell_value ? (0, utils_1.formatEth)(r.floor_sell_value) : null,
                    topBidValue: r.top_buy_value ? (0, utils_1.formatEth)(r.top_buy_value) : null,
                    totalBidValue: r.total_buy_value ? (0, utils_1.formatEth)(r.total_buy_value) : null,
                },
            })));
            return { owners: result };
        }
        catch (error) {
            logger_1.logger.error(`get-owners-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map