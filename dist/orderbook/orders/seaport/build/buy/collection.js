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
exports.build = void 0;
const Sdk = __importStar(require("@reservoir0x/sdk"));
const helpers_1 = require("@reservoir0x/sdk/dist/common/helpers");
const db_1 = require("@/common/db");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const utils = __importStar(require("@/orderbook/orders/seaport/build/utils"));
const utils_2 = require("@/orderbook/orders/utils");
const build = async (options) => {
    var _a;
    const collectionResult = await db_1.redb.oneOrNone(`
      SELECT
        collections.token_set_id,
        collections.token_count,
        collections.contract
      FROM collections
      WHERE collections.id = $/collection/
    `, { collection: options.collection });
    if (!collectionResult) {
        throw new Error("Could not retrieve collection");
    }
    if (Number(collectionResult.token_count) > index_1.config.maxTokenSetSize) {
        throw new Error("Collection has too many items");
    }
    const buildInfo = await utils.getBuildInfo({
        ...options,
        contract: (0, utils_1.fromBuffer)(collectionResult.contract),
    }, options.collection, "buy");
    const collectionIsContractWide = (_a = collectionResult.token_set_id) === null || _a === void 0 ? void 0 : _a.startsWith("contract:");
    if (!options.excludeFlaggedTokens && collectionIsContractWide) {
        // Use contract-wide order
        const builder = new Sdk.Seaport.Builders.ContractWide(index_1.config.chainId);
        return builder === null || builder === void 0 ? void 0 : builder.build(buildInfo.params);
    }
    else {
        // Use token-list order
        // For up-to-date results we need to compute the corresponding token set id
        // from the tokens table. However, that can be computationally-expensive so
        // we go through two levels of caches before performing the computation.
        let cachedMerkleRoot = null;
        if (options.excludeFlaggedTokens) {
            // Attempt 1: fetch the token set id for non-flagged tokens directly from the collections
            const result = await db_1.redb.oneOrNone(`
          SELECT
            collections.non_flagged_token_set_id
          FROM collections
          WHERE collections.id = $/id/
        `, { id: options.collection });
            if (result === null || result === void 0 ? void 0 : result.non_flagged_token_set_id) {
                cachedMerkleRoot = result === null || result === void 0 ? void 0 : result.non_flagged_token_set_id.split(":")[2];
            }
        }
        // Build the resulting token set's schema
        const schema = {
            kind: options.excludeFlaggedTokens ? "collection-non-flagged" : "collection",
            data: {
                collection: options.collection,
            },
        };
        const schemaHash = (0, utils_2.generateSchemaHash)(schema);
        if (!cachedMerkleRoot) {
            // Attempt 2: use a cached version of the token set
            cachedMerkleRoot = await redis_1.redis.get(schemaHash);
        }
        if (!cachedMerkleRoot) {
            // Attempt 3 (final - will definitely work): compute the token set id (can be computationally-expensive)
            // Fetch all relevant tokens from the collection
            const tokens = await db_1.redb.manyOrNone(`
          SELECT
            tokens.token_id
          FROM tokens
          WHERE tokens.collection_id = $/collection/
          ${options.excludeFlaggedTokens ? "AND tokens.is_flagged = 0" : ""}
        `, { collection: options.collection });
            // Also cache the computation for one hour
            cachedMerkleRoot = (0, helpers_1.generateMerkleTree)(tokens.map(({ token_id }) => token_id)).getHexRoot();
            await redis_1.redis.set(schemaHash, cachedMerkleRoot, "ex", 3600);
        }
        const builder = new Sdk.Seaport.Builders.TokenList(index_1.config.chainId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buildInfo.params.merkleRoot = cachedMerkleRoot;
        return builder === null || builder === void 0 ? void 0 : builder.build(buildInfo.params);
    }
};
exports.build = build;
//# sourceMappingURL=collection.js.map