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
exports.processEvents = void 0;
const utils_1 = require("@/events-sync/handlers/utils");
const erc20 = __importStar(require("@/events-sync/handlers/erc20"));
const erc721 = __importStar(require("@/events-sync/handlers/erc721"));
const erc1155 = __importStar(require("@/events-sync/handlers/erc1155"));
const blur = __importStar(require("@/events-sync/handlers/blur"));
const cryptopunks = __importStar(require("@/events-sync/handlers/cryptopunks"));
const element = __importStar(require("@/events-sync/handlers/element"));
const foundation = __importStar(require("@/events-sync/handlers/foundation"));
const looksrare = __importStar(require("@/events-sync/handlers/looks-rare"));
const nftx = __importStar(require("@/events-sync/handlers/nftx"));
const nouns = __importStar(require("@/events-sync/handlers/nouns"));
const quixotic = __importStar(require("@/events-sync/handlers/quixotic"));
const seaport = __importStar(require("@/events-sync/handlers/seaport"));
const sudoswap = __importStar(require("@/events-sync/handlers/sudoswap"));
const wyvern = __importStar(require("@/events-sync/handlers/wyvern"));
const x2y2 = __importStar(require("@/events-sync/handlers/x2y2"));
const zeroExV4 = __importStar(require("@/events-sync/handlers/zeroex-v4"));
const zora = __importStar(require("@/events-sync/handlers/zora"));
const universe = __importStar(require("@/events-sync/handlers/universe"));
const processEvents = async (info) => {
    let data;
    switch (info.kind) {
        case "erc20": {
            data = await erc20.handleEvents(info.events);
            break;
        }
        case "erc721": {
            data = await erc721.handleEvents(info.events);
            break;
        }
        case "erc1155": {
            data = await erc1155.handleEvents(info.events);
            break;
        }
        case "blur": {
            data = await blur.handleEvents(info.events);
            break;
        }
        case "cryptopunks": {
            data = await cryptopunks.handleEvents(info.events);
            break;
        }
        case "element": {
            data = await element.handleEvents(info.events);
            break;
        }
        case "foundation": {
            data = await foundation.handleEvents(info.events);
            break;
        }
        case "looks-rare": {
            data = await looksrare.handleEvents(info.events);
            break;
        }
        case "nftx": {
            data = await nftx.handleEvents(info.events);
            break;
        }
        case "nouns": {
            data = await nouns.handleEvents(info.events);
            break;
        }
        case "quixotic": {
            data = await quixotic.handleEvents(info.events);
            break;
        }
        case "seaport": {
            data = await seaport.handleEvents(info.events);
            break;
        }
        case "sudoswap": {
            data = await sudoswap.handleEvents(info.events);
            break;
        }
        case "wyvern": {
            data = await wyvern.handleEvents(info.events);
            break;
        }
        case "x2y2": {
            data = await x2y2.handleEvents(info.events);
            break;
        }
        case "zeroex-v4": {
            data = await zeroExV4.handleEvents(info.events, info.backfill);
            break;
        }
        case "zora": {
            data = await zora.handleEvents(info.events);
            break;
        }
        case "universe": {
            data = await universe.handleEvents(info.events);
            break;
        }
    }
    if (data) {
        await (0, utils_1.processOnChainData)(data, info.backfill);
    }
};
exports.processEvents = processEvents;
//# sourceMappingURL=index.js.map