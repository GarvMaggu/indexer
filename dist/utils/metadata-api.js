"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.MetadataApi = void 0;
const abi_1 = require("@ethersproject/abi");
const contracts_1 = require("@ethersproject/contracts");
const axios_1 = __importDefault(require("axios"));
const slugify_1 = __importDefault(require("slugify"));
const provider_1 = require("@/common/provider");
const index_1 = require("@/config/index");
const network_1 = require("@/config/network");
class MetadataApi {
    static async getCollectionMetadata(contract, tokenId, options) {
        if (index_1.config.liquidityOnly) {
            // When running in liquidity-only mode:
            // - assume the collection id matches the contract address
            // - the collection name is retrieved from an on-chain `name()` call
            const name = await new contracts_1.Contract(contract, new abi_1.Interface(["function name() view returns (string)"]), provider_1.baseProvider)
                .name()
                .catch(() => "");
            return {
                id: contract,
                slug: (0, slugify_1.default)(name, { lower: true }),
                name,
                community: null,
                metadata: null,
                royalties: null,
                contract,
                tokenIdRange: null,
                tokenSetId: `contract:${contract}`,
            };
        }
        else {
            const url = `${index_1.config.metadataApiBaseUrlAlt}/v4/${(0, network_1.getNetworkName)()}/metadata/collection?method=${index_1.config.metadataIndexingMethodCollection}&token=${contract}:${tokenId}`;
            const { data } = await axios_1.default.get(url);
            const collection = data.collection;
            if (collection.isFallback && !(options === null || options === void 0 ? void 0 : options.allowFallback)) {
                throw new Error("Fallback collection data not acceptable");
            }
            return collection;
        }
    }
    static async getTokensMetadata(tokens, useAltUrl = false, method = "") {
        const queryParams = new URLSearchParams();
        for (const token of tokens) {
            queryParams.append("token", `${token.contract}:${token.tokenId}`);
        }
        method = method === "" ? index_1.config.metadataIndexingMethod : method;
        const url = `${useAltUrl ? index_1.config.metadataApiBaseUrlAlt : index_1.config.metadataApiBaseUrl}/v4/${(0, network_1.getNetworkName)()}/metadata/token?method=${method}&${queryParams.toString()}`;
        const { data } = await axios_1.default.get(url);
        const tokenMetadata = data.metadata;
        return tokenMetadata;
    }
}
exports.MetadataApi = MetadataApi;
exports.default = MetadataApi;
//# sourceMappingURL=metadata-api.js.map