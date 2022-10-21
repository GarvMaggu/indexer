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
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const utils = __importStar(require("@/orderbook/orders/seaport/build/utils"));
const build = async (options) => {
    const builder = new Sdk.Seaport.Builders.TokenList(index_1.config.chainId);
    if (options.collection && options.attributes) {
        if (options.attributes.length !== 1) {
            throw new Error("Attribute bids must be on a single attribute");
        }
        const attributeResult = await db_1.redb.oneOrNone(`
        SELECT
          collections.contract,
          attributes.token_count
        FROM attributes
        JOIN attribute_keys
          ON attributes.attribute_key_id = attribute_keys.id
        JOIN collections
          ON attribute_keys.collection_id = collections.id
        WHERE attribute_keys.collection_id = $/collection/
          AND attribute_keys.key = $/key/
          AND attributes.value = $/value/
      `, {
            collection: options.collection,
            key: options.attributes[0].key,
            value: options.attributes[0].value,
        });
        if (!attributeResult) {
            throw new Error("Could not retrieve attribute info");
        }
        if (Number(attributeResult.token_count) > index_1.config.maxTokenSetSize) {
            throw new Error("Attribute has too many items");
        }
        const buildInfo = await utils.getBuildInfo({
            ...options,
            contract: (0, utils_1.fromBuffer)(attributeResult.contract),
        }, options.collection, "buy");
        const excludeFlaggedTokens = options.excludeFlaggedTokens ? "AND tokens.is_flagged = 0" : "";
        // Fetch all tokens matching the attributes
        const tokens = await db_1.redb.manyOrNone(`
        SELECT token_attributes.token_id
        FROM token_attributes
        JOIN attributes ON token_attributes.attribute_id = attributes.id
        JOIN attribute_keys ON attributes.attribute_key_id = attribute_keys.id
        JOIN tokens ON token_attributes.contract = tokens.contract AND token_attributes.token_id = tokens.token_id
        WHERE attribute_keys.collection_id = $/collection/
        AND attribute_keys.key = $/key/
        AND attributes.value = $/value/
        ${excludeFlaggedTokens}
        ORDER BY token_attributes.token_id
      `, {
            collection: options.collection,
            key: options.attributes[0].key,
            value: options.attributes[0].value,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buildInfo.params.tokenIds = tokens.map(({ token_id }) => token_id);
        return builder === null || builder === void 0 ? void 0 : builder.build(buildInfo.params);
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
        const buildInfo = await utils.getBuildInfo({
            ...options,
            contract: (0, utils_1.fromBuffer)(tokens[0].contract),
        }, (0, utils_1.fromBuffer)(tokens[0].contract), "buy");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buildInfo.params.tokenIds = tokens.map(({ token_id }) => token_id);
        return builder === null || builder === void 0 ? void 0 : builder.build(buildInfo.params);
    }
};
exports.build = build;
//# sourceMappingURL=attribute.js.map