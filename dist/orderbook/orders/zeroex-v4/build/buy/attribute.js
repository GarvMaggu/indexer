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
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const utils = __importStar(require("@/orderbook/orders/zeroex-v4/build/utils"));
const build = async (options) => {
    let buildInfo;
    let tokenIds;
    if (options.collection && options.attributes) {
        if (options.attributes.length !== 1) {
            // TODO: Support more than one attribute
            throw new Error("Attribute bids must be on a single attribute");
        }
        const attributeResult = await db_1.redb.oneOrNone(`
        SELECT
          "c"."contract",
          "a"."token_count"
        FROM "attributes" "a"
        JOIN "attribute_keys" "ak"
          ON "a"."attribute_key_id" = "ak"."id"
        JOIN "collections" "c"
          ON "ak"."collection_id" = "c"."id"
        WHERE "ak"."collection_id" = $/collection/
          AND "ak"."key" = $/key/
          AND "a"."value" = $/value/
      `, {
            collection: options.collection,
            key: options.attributes[0].key,
            value: options.attributes[0].value,
        });
        if (!attributeResult.token_count) {
            // Skip if we cannot retrieve the collection
            throw new Error("Could not retrieve attribute info");
        }
        if (Number(attributeResult.token_count) > index_1.config.maxTokenSetSize) {
            // We don't support attribute orders on large token sets
            throw new Error("Attribute has too many items");
        }
        buildInfo = await utils.getBuildInfo({
            ...options,
            contract: (0, utils_1.fromBuffer)(attributeResult.contract),
        }, options.collection, "buy");
        const excludeFlaggedTokens = options.excludeFlaggedTokens ? `AND "t"."is_flagged" = 0` : "";
        // Fetch all tokens matching the attributes
        const tokens = await db_1.redb.manyOrNone(`
        SELECT "ta"."token_id"
        FROM "token_attributes" "ta"
        JOIN "attributes" "a" ON "ta"."attribute_id" = "a"."id"
        JOIN "attribute_keys" "ak" ON "a"."attribute_key_id" = "ak"."id"
        JOIN "tokens" "t" ON "ta"."contract" = "t"."contract" AND "ta"."token_id" = "t"."token_id"
        WHERE "ak"."collection_id" = $/collection/
        AND "ak"."key" = $/key/
        AND "a"."value" = $/value/
        ${excludeFlaggedTokens}
        ORDER BY "ta"."token_id"
      `, {
            collection: options.collection,
            key: options.attributes[0].key,
            value: options.attributes[0].value,
        });
        tokenIds = tokens.map(({ token_id }) => token_id);
    }
    else {
        // Fetch all tokens matching the token set
        const tokens = await db_1.redb.manyOrNone(`
        SELECT
          token_sets_tokens.contract,
          token_sets_tokens.token_id
        FROM token_sets_tokens
        WHERE token_sets_tokens.token_set_id = $/tokenSetId/
      `, {
            tokenSetId: options.tokenSetId,
        });
        buildInfo = await utils.getBuildInfo({
            ...options,
            contract: (0, utils_1.fromBuffer)(tokens[0].contract),
        }, (0, utils_1.fromBuffer)(tokens[0].contract), "buy");
        tokenIds = tokens.map(({ token_id }) => token_id);
    }
    if (!buildInfo) {
        // Skip if we cannot generate the build information
        throw new Error("Could not generate build info");
    }
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildInfo.params.tokenIds = tokenIds;
    return builder === null || builder === void 0 ? void 0 : builder.build(buildInfo.params);
};
exports.build = build;
//# sourceMappingURL=attribute.js.map