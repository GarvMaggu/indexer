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
const bit_vector_1 = require("@reservoir0x/sdk/dist/common/helpers/bit-vector");
const packed_list_1 = require("@reservoir0x/sdk/dist/common/helpers/packed-list");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const utils = __importStar(require("@/orderbook/orders/zeroex-v4/build/utils"));
const build = async (options) => {
    try {
        const collectionResult = await db_1.redb.oneOrNone(`
        SELECT
          collections.token_set_id,
          collections.token_count,
          collections.contract
        FROM collections
        WHERE collections.id = $/collection/
      `, { collection: options.collection });
        if (!collectionResult) {
            // Skip if we cannot retrieve the collection.
            return undefined;
        }
        if (Number(collectionResult.token_count) > index_1.config.maxTokenSetSize) {
            // We don't support collection orders on large collections.
            return undefined;
        }
        const buildInfo = await utils.getBuildInfo({
            ...options,
            contract: (0, utils_1.fromBuffer)(collectionResult.contract),
        }, options.collection, "buy");
        if (!buildInfo) {
            // Skip if we cannot generate the build information.
            return undefined;
        }
        if (!options.excludeFlaggedTokens) {
            let builder;
            if (buildInfo.kind === "erc721") {
                builder = collectionResult.token_set_id.startsWith("contract:")
                    ? new Sdk.ZeroExV4.Builders.ContractWide(index_1.config.chainId)
                    : new Sdk.ZeroExV4.Builders.TokenRange(index_1.config.chainId);
            }
            else if (buildInfo.kind === "erc1155") {
                builder = collectionResult.token_set_id.startsWith("contract:")
                    ? new Sdk.ZeroExV4.Builders.ContractWide(index_1.config.chainId)
                    : new Sdk.ZeroExV4.Builders.TokenRange(index_1.config.chainId);
            }
            if (!collectionResult.token_set_id.startsWith("contract:")) {
                const [, , startTokenId, endTokenId] = collectionResult.token_set_id.split(":");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                buildInfo.params.startTokenId = startTokenId;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                buildInfo.params.endTokenId = endTokenId;
            }
            return builder === null || builder === void 0 ? void 0 : builder.build(buildInfo.params);
        }
        else {
            const excludeFlaggedTokens = options.excludeFlaggedTokens ? "AND tokens.is_flagged = 0" : "";
            // Fetch all non-flagged tokens from the collection
            const tokens = await db_1.redb.manyOrNone(`
          SELECT
            tokens.token_id
          FROM tokens
          WHERE tokens.collection_id = $/collection/
          ${excludeFlaggedTokens}
        `, {
                collection: options.collection,
            });
            const tokenIds = tokens.map(({ token_id }) => token_id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            buildInfo.params.tokenIds = tokenIds;
            // TODO: De-duplicate code
            // Choose the most gas-efficient method for checking (bit vector vs packed list)
            let bitVectorCost = -1;
            if ((0, utils_1.bn)(tokenIds[tokenIds.length - 1]).lte(200000)) {
                bitVectorCost = (0, bit_vector_1.getBitVectorCalldataSize)(tokenIds.map(Number));
            }
            const packedListCost = (0, packed_list_1.getPackedListCalldataSize)(tokenIds);
            // If the calldata exceeds ~50.000 bytes we simply revert
            const costThreshold = 100000;
            let builder;
            if (bitVectorCost == -1 || bitVectorCost > packedListCost) {
                if (packedListCost > costThreshold) {
                    throw new Error("Cost too high");
                }
                if (buildInfo.kind === "erc721") {
                    builder = new Sdk.ZeroExV4.Builders.TokenList.PackedList(index_1.config.chainId);
                }
                else if (buildInfo.kind === "erc1155") {
                    builder = new Sdk.ZeroExV4.Builders.TokenList.PackedList(index_1.config.chainId);
                }
            }
            else {
                if (bitVectorCost > costThreshold) {
                    throw new Error("Cost too high");
                }
                if (buildInfo.kind === "erc721") {
                    builder = new Sdk.ZeroExV4.Builders.TokenList.BitVector(index_1.config.chainId);
                }
                else if (buildInfo.kind === "erc1155") {
                    builder = new Sdk.ZeroExV4.Builders.TokenList.BitVector(index_1.config.chainId);
                }
            }
            return builder === null || builder === void 0 ? void 0 : builder.build(buildInfo.params);
        }
    }
    catch (error) {
        logger_1.logger.error("zeroex-v4-build-buy-collection-order", `Failed to build order: ${error}`);
        return undefined;
    }
};
exports.build = build;
//# sourceMappingURL=collection.js.map