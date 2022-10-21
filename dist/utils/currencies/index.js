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
exports.tryGetCurrencyDetails = exports.getCurrency = void 0;
const abi_1 = require("@ethersproject/abi");
const contracts_1 = require("@ethersproject/contracts");
const axios_1 = __importDefault(require("axios"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const provider_1 = require("@/common/provider");
const utils_1 = require("@/common/utils");
const network_1 = require("@/config/network");
const currenciesQueue = __importStar(require("@/jobs/currencies/index"));
const CURRENCY_MEMORY_CACHE = new Map();
const getCurrency = async (currencyAddress) => {
    if (!CURRENCY_MEMORY_CACHE.has(currencyAddress)) {
        const result = await db_1.idb.oneOrNone(`
        SELECT
          currencies.name,
          currencies.symbol,
          currencies.decimals,
          currencies.metadata
        FROM currencies
        WHERE currencies.contract = $/contract/
      `, {
            contract: (0, utils_1.toBuffer)(currencyAddress),
        });
        if (result) {
            CURRENCY_MEMORY_CACHE.set(currencyAddress, {
                contract: currencyAddress,
                name: result.name,
                symbol: result.symbol,
                decimals: result.decimals,
                metadata: result.metadata,
            });
        }
        else {
            let name;
            let symbol;
            let decimals;
            let metadata = {};
            // If the currency is not available, then we try to retrieve its details
            try {
                ({ name, symbol, decimals, metadata } = await (0, exports.tryGetCurrencyDetails)(currencyAddress));
            }
            catch (error) {
                logger_1.logger.error("currencies", `Failed to initially fetch ${currencyAddress} currency details: ${error}`);
                // TODO: Although an edge case, we should ensure that when the job
                // finally succeeds fetching the details of a currency, we also do
                // update the memory cache (otherwise the cache will be stale).
                // Retry fetching the currency details
                await currenciesQueue.addToQueue({ currency: currencyAddress });
            }
            await db_1.idb.none(`
          INSERT INTO currencies (
            contract,
            name,
            symbol,
            decimals,
            metadata
          ) VALUES (
            $/contract/,
            $/name/,
            $/symbol/,
            $/decimals/,
            $/metadata:json/
          ) ON CONFLICT DO NOTHING
        `, {
                contract: (0, utils_1.toBuffer)(currencyAddress),
                name,
                symbol,
                decimals,
                metadata,
            });
            CURRENCY_MEMORY_CACHE.set(currencyAddress, {
                contract: currencyAddress,
                name,
                symbol,
                decimals,
                metadata,
            });
        }
    }
    return CURRENCY_MEMORY_CACHE.get(currencyAddress);
};
exports.getCurrency = getCurrency;
const tryGetCurrencyDetails = async (currencyAddress) => {
    var _a, _b;
    // `name`, `symbol` and `decimals` are fetched from on-chain
    const iface = new abi_1.Interface([
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
    ]);
    const contract = new contracts_1.Contract(currencyAddress, iface, provider_1.baseProvider);
    const name = await contract.name();
    const symbol = await contract.symbol();
    const decimals = await contract.decimals();
    const metadata = {};
    const coingeckoNetworkId = (_a = (0, network_1.getNetworkSettings)().coingecko) === null || _a === void 0 ? void 0 : _a.networkId;
    if (coingeckoNetworkId) {
        const result = await axios_1.default
            .get(`https://api.coingecko.com/api/v3/coins/${coingeckoNetworkId}/contract/${currencyAddress}`, { timeout: 10 * 1000 })
            .then((response) => response.data);
        if (result.id) {
            metadata.coingeckoCurrencyId = result.id;
        }
        if ((_b = result.image) === null || _b === void 0 ? void 0 : _b.large) {
            metadata.image = result.image.large;
        }
    }
    return {
        name,
        symbol,
        decimals,
        metadata,
    };
};
exports.tryGetCurrencyDetails = tryGetCurrencyDetails;
//# sourceMappingURL=index.js.map