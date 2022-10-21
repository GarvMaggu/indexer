"use strict";
// Exports
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
exports.generateBidDetailsNew = exports.generateListingDetailsNew = exports.generateBidDetails = exports.generateListingDetails = exports.getOrderSourceByOrderKind = exports.universe = exports.zora = exports.zeroExV4 = exports.x2y2 = exports.sudoswap = exports.seaport = exports.looksRare = exports.foundation = exports.cryptopunks = void 0;
exports.cryptopunks = __importStar(require("@/orderbook/orders/cryptopunks"));
exports.foundation = __importStar(require("@/orderbook/orders/foundation"));
exports.looksRare = __importStar(require("@/orderbook/orders/looks-rare"));
exports.seaport = __importStar(require("@/orderbook/orders/seaport"));
exports.sudoswap = __importStar(require("@/orderbook/orders/sudoswap"));
exports.x2y2 = __importStar(require("@/orderbook/orders/x2y2"));
exports.zeroExV4 = __importStar(require("@/orderbook/orders/zeroex-v4"));
exports.zora = __importStar(require("@/orderbook/orders/zora"));
exports.universe = __importStar(require("@/orderbook/orders/universe"));
// Imports
const Sdk = __importStar(require("@reservoir0x/sdk"));
const NewSdk = __importStar(require("@reservoir0x/sdk-new"));
const db_1 = require("@/common/db");
const index_1 = require("@/config/index");
const sources_1 = require("@/models/sources");
// In case we don't have the source of an order readily available, we use
// a default value where possible (since very often the exchange protocol
// is tightly coupled to a source marketplace and we just assume that the
// bulk of orders from a protocol come from known that marketplace).
const mintsSources = new Map();
mintsSources.set("0x059edd72cd353df5106d2b9cc5ab83a52287ac3a", "artblocks.io");
mintsSources.set("0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270", "artblocks.io");
mintsSources.set("0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85", "ens.domains");
mintsSources.set("0x495f947276749ce646f68ac8c248420045cb7b5e", "opensea.io");
mintsSources.set("0xc9154424b823b10579895ccbe442d41b9abd96ed", "rarible.com");
mintsSources.set("0xb66a603f4cfe17e3d27b87a8bfcad319856518b8", "rarible.com");
mintsSources.set("0xc143bbfcdbdbed6d454803804752a064a622c1f3", "async.art");
mintsSources.set("0xfbeef911dc5821886e1dda71586d90ed28174b7d", "knownorigin.io");
const getOrderSourceByOrderKind = async (orderKind, address) => {
    try {
        const sources = await sources_1.Sources.getInstance();
        switch (orderKind) {
            case "x2y2":
                return sources.getOrInsert("x2y2.io");
            case "foundation":
                return sources.getOrInsert("foundation.app");
            case "looks-rare":
                return sources.getOrInsert("looksrare.org");
            case "seaport":
            case "wyvern-v2":
            case "wyvern-v2.3":
                return sources.getOrInsert("opensea.io");
            case "rarible":
                return sources.getOrInsert("rarible.com");
            case "element-erc721":
            case "element-erc1155":
                return sources.getOrInsert("element.market");
            case "quixotic":
                return sources.getOrInsert("quixotic.io");
            case "zora-v3":
                return sources.getOrInsert("zora.co");
            case "nouns":
                return sources.getOrInsert("nouns.wtf");
            case "cryptopunks":
                return sources.getOrInsert("cryptopunks.app");
            case "sudoswap":
                return sources.getOrInsert("sudoswap.xyz");
            case "universe":
                return sources.getOrInsert("universe.xyz");
            case "nftx":
                return sources.getOrInsert("nftx.io");
            case "blur":
                return sources.getOrInsert("blur.io");
            case "mint": {
                if (address && mintsSources.has(address)) {
                    return sources.getOrInsert(mintsSources.get(address));
                }
            }
        }
    }
    catch {
        // Skip on any errors
    }
    // In case nothing matched, return `undefined` by default
};
exports.getOrderSourceByOrderKind = getOrderSourceByOrderKind;
// Support for filling listings
const generateListingDetails = (order, token) => {
    var _a;
    const common = {
        contractKind: token.kind,
        contract: token.contract,
        tokenId: token.tokenId,
        currency: order.currency,
        amount: (_a = token.amount) !== null && _a !== void 0 ? _a : 1,
    };
    switch (order.kind) {
        case "foundation": {
            return {
                kind: "foundation",
                ...common,
                order: new Sdk.Foundation.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "looks-rare": {
            return {
                kind: "looks-rare",
                ...common,
                order: new Sdk.LooksRare.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "x2y2": {
            return {
                kind: "x2y2",
                ...common,
                order: new Sdk.X2Y2.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "zeroex-v4-erc721":
        case "zeroex-v4-erc1155": {
            return {
                kind: "zeroex-v4",
                ...common,
                order: new Sdk.ZeroExV4.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "seaport": {
            return {
                kind: "seaport",
                ...common,
                order: new Sdk.Seaport.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "zora-v3": {
            return {
                kind: "zora",
                ...common,
                order: new Sdk.Zora.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "universe": {
            return {
                kind: "universe",
                ...common,
                order: new Sdk.Universe.Order(index_1.config.chainId, order.rawData),
            };
        }
        default: {
            throw new Error("Unsupported order kind");
        }
    }
};
exports.generateListingDetails = generateListingDetails;
// Support for filling bids
const generateBidDetails = async (order, token) => {
    var _a, _b;
    const common = {
        contractKind: token.kind,
        contract: token.contract,
        tokenId: token.tokenId,
        amount: (_a = token.amount) !== null && _a !== void 0 ? _a : 1,
    };
    switch (order.kind) {
        case "seaport": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const extraArgs = {};
            const sdkOrder = new Sdk.Seaport.Order(index_1.config.chainId, order.rawData);
            if ((_b = sdkOrder.params.kind) === null || _b === void 0 ? void 0 : _b.includes("token-list")) {
                // When filling a "token-list" order, we also need to pass in the
                // full list of tokens the order was made on (in order to be able
                // to generate a valid merkle proof)
                const tokens = await db_1.redb.manyOrNone(`
            SELECT
              token_sets_tokens.token_id
            FROM token_sets_tokens
            WHERE token_sets_tokens.token_set_id = (
              SELECT
                orders.token_set_id
              FROM orders
              WHERE orders.id = $/id/
            )
          `, { id: sdkOrder.hash() });
                extraArgs.tokenIds = tokens.map(({ token_id }) => token_id);
            }
            return {
                kind: "seaport",
                ...common,
                extraArgs,
                order: sdkOrder,
            };
        }
        case "looks-rare": {
            const sdkOrder = new Sdk.LooksRare.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "looks-rare",
                ...common,
                order: sdkOrder,
            };
        }
        case "zeroex-v4-erc721":
        case "zeroex-v4-erc1155": {
            const sdkOrder = new Sdk.ZeroExV4.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "zeroex-v4",
                ...common,
                order: sdkOrder,
            };
        }
        case "x2y2": {
            const sdkOrder = new Sdk.X2Y2.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "x2y2",
                ...common,
                order: sdkOrder,
            };
        }
        case "sudoswap": {
            const sdkOrder = new Sdk.Sudoswap.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "sudoswap",
                ...common,
                order: sdkOrder,
            };
        }
        case "universe": {
            const sdkOrder = new Sdk.Universe.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "universe",
                ...common,
                order: sdkOrder,
                extraArgs: {
                    amount: sdkOrder.params.take.value,
                },
            };
        }
        default: {
            throw new Error("Unsupported order kind");
        }
    }
};
exports.generateBidDetails = generateBidDetails;
// NEW SDK METHODS
// Support for filling listings
const generateListingDetailsNew = (order, token) => {
    var _a;
    const common = {
        contractKind: token.kind,
        contract: token.contract,
        tokenId: token.tokenId,
        currency: order.currency,
        amount: (_a = token.amount) !== null && _a !== void 0 ? _a : 1,
    };
    switch (order.kind) {
        case "foundation": {
            return {
                kind: "foundation",
                ...common,
                order: new NewSdk.Foundation.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "looks-rare": {
            return {
                kind: "looks-rare",
                ...common,
                order: new NewSdk.LooksRare.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "x2y2": {
            return {
                kind: "x2y2",
                ...common,
                order: new NewSdk.X2Y2.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "zeroex-v4-erc721":
        case "zeroex-v4-erc1155": {
            return {
                kind: "zeroex-v4",
                ...common,
                order: new NewSdk.ZeroExV4.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "seaport": {
            return {
                kind: "seaport",
                ...common,
                order: new NewSdk.Seaport.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "zora-v3": {
            return {
                kind: "zora",
                ...common,
                order: new NewSdk.Zora.Order(index_1.config.chainId, order.rawData),
            };
        }
        case "universe": {
            return {
                kind: "universe",
                ...common,
                order: new NewSdk.Universe.Order(index_1.config.chainId, order.rawData),
            };
        }
        default: {
            throw new Error("Unsupported order kind");
        }
    }
};
exports.generateListingDetailsNew = generateListingDetailsNew;
// Support for filling bids
const generateBidDetailsNew = async (order, token) => {
    var _a, _b;
    const common = {
        contractKind: token.kind,
        contract: token.contract,
        tokenId: token.tokenId,
        amount: (_a = token.amount) !== null && _a !== void 0 ? _a : 1,
    };
    switch (order.kind) {
        case "seaport": {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const extraArgs = {};
            const sdkOrder = new NewSdk.Seaport.Order(index_1.config.chainId, order.rawData);
            if ((_b = sdkOrder.params.kind) === null || _b === void 0 ? void 0 : _b.includes("token-list")) {
                // When filling a "token-list" order, we also need to pass in the
                // full list of tokens the order was made on (in order to be able
                // to generate a valid merkle proof)
                const tokens = await db_1.redb.manyOrNone(`
            SELECT
              token_sets_tokens.token_id
            FROM token_sets_tokens
            WHERE token_sets_tokens.token_set_id = (
              SELECT
                orders.token_set_id
              FROM orders
              WHERE orders.id = $/id/
            )
          `, { id: sdkOrder.hash() });
                extraArgs.tokenIds = tokens.map(({ token_id }) => token_id);
            }
            return {
                kind: "seaport",
                ...common,
                extraArgs,
                order: sdkOrder,
            };
        }
        case "looks-rare": {
            const sdkOrder = new NewSdk.LooksRare.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "looks-rare",
                ...common,
                order: sdkOrder,
            };
        }
        case "zeroex-v4-erc721":
        case "zeroex-v4-erc1155": {
            const sdkOrder = new NewSdk.ZeroExV4.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "zeroex-v4",
                ...common,
                order: sdkOrder,
            };
        }
        case "x2y2": {
            const sdkOrder = new NewSdk.X2Y2.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "x2y2",
                ...common,
                order: sdkOrder,
            };
        }
        case "sudoswap": {
            const sdkOrder = new NewSdk.Sudoswap.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "sudoswap",
                ...common,
                order: sdkOrder,
            };
        }
        case "universe": {
            const sdkOrder = new NewSdk.Universe.Order(index_1.config.chainId, order.rawData);
            return {
                kind: "universe",
                ...common,
                order: sdkOrder,
            };
        }
        default: {
            throw new Error("Unsupported order kind");
        }
    }
};
exports.generateBidDetailsNew = generateBidDetailsNew;
//# sourceMappingURL=index.js.map