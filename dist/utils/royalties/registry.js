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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshRegistryRoyalties = void 0;
const abi_1 = require("@ethersproject/abi");
const contracts_1 = require("@ethersproject/contracts");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const lodash_1 = __importDefault(require("lodash"));
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const db_1 = require("@/common/db");
const DEFAULT_PRICE = "1000000000000000000";
// Assume there are no per-token royalties but everything is per-contract
const refreshRegistryRoyalties = async (collection) => {
    // Fetch the collection's contract
    const collectionResult = await db_1.idb.oneOrNone(`
      SELECT
        collections.contract
      FROM collections
      WHERE collections.id = $/collection/
    `, { collection });
    if (!(collectionResult === null || collectionResult === void 0 ? void 0 : collectionResult.contract)) {
        return [];
    }
    // Fetch a random token from the collection
    const tokenResult = await db_1.idb.oneOrNone(`
      SELECT
        tokens.token_id
      FROM tokens
      WHERE tokens.collection_id = $/collection/
      LIMIT 1
    `, { collection });
    if (!(tokenResult === null || tokenResult === void 0 ? void 0 : tokenResult.token_id)) {
        return [];
    }
    const token = (0, utils_1.fromBuffer)(collectionResult.contract);
    const tokenId = tokenResult.token_id;
    if (Sdk.Common.Addresses.RoyaltyEngine[index_1.config.chainId]) {
        const royaltyEngine = new contracts_1.Contract(Sdk.Common.Addresses.RoyaltyEngine[index_1.config.chainId], new abi_1.Interface([
            `
          function getCachedRoyaltySpec(
            address token
          ) external view returns (int16)
        `,
            `
          function getRoyaltyView(
            address token,
            uint256 tokenId,
            uint256 value
          ) external view returns (
            address[] recipients,
            uint256[] amounts
          )
        `,
        ]), provider_1.baseProvider);
        try {
            // Fetch the royalty standard
            const spec = await royaltyEngine.getCachedRoyaltySpec(token).then((value) => {
                // Reference:
                // https://github.com/manifoldxyz/royalty-registry-solidity/blob/fee5379264bc56e0ad93d0147bbd54086b37b864/contracts/RoyaltyEngineV1.sol#L34-L44
                switch (value) {
                    case 1:
                        return "manifold";
                    case 2:
                        return "rarible_v1";
                    case 3:
                        return "rarible_v2";
                    case 4:
                        return "foundation";
                    case 5:
                        return "eip2981";
                    case 6:
                        return "superrare";
                    case 7:
                        return "zora";
                    case 8:
                        return "artblocks";
                    case 9:
                        return "knownorigin_v2";
                    default:
                        return undefined;
                }
            });
            if (!spec) {
                throw new Error("Unknown or missing royalties");
            }
            // The royalties are returned in full amounts, but we store them as a percentage
            // so here we just use a default price (which is a round number) and deduce then
            // deduce the percentage taken as royalties from that
            const { recipients, amounts } = await royaltyEngine.getRoyaltyView(token, tokenId, DEFAULT_PRICE);
            const latestRoyalties = [];
            for (let i = 0; i < amounts.length; i++) {
                const recipient = recipients[i].toLowerCase();
                const amount = amounts[i];
                if ((0, utils_1.bn)(amount).gte(DEFAULT_PRICE)) {
                    throw new Error("Royalty exceeds price");
                }
                const bps = Math.round((0, utils_1.bn)(amount).mul(10000).div(DEFAULT_PRICE).toNumber());
                latestRoyalties.push({ recipient, bps });
            }
            const royaltiesResult = await db_1.idb.oneOrNone(`
          SELECT
            COALESCE(collections.new_royalties, '{}') AS royalties
          FROM collections
          WHERE collections.id = $/collection/
        `, { collection });
            if (royaltiesResult) {
                if (!lodash_1.default.isEqual(royaltiesResult.royalties[spec], latestRoyalties)) {
                    royaltiesResult.royalties[spec] = latestRoyalties;
                    await db_1.idb.none(`
              UPDATE collections SET
                new_royalties = $/royalties:json/
              WHERE collections.id = $/collection/
            `, {
                        collection,
                        royalties: royaltiesResult.royalties,
                    });
                }
            }
            return latestRoyalties;
        }
        catch {
            // Skip any errors
        }
    }
    return [];
};
exports.refreshRegistryRoyalties = refreshRegistryRoyalties;
//# sourceMappingURL=registry.js.map