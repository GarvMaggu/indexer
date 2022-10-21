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
exports.getUSDAndNativePrices = void 0;
const constants_1 = require("@ethersproject/constants");
const units_1 = require("@ethersproject/units");
const Sdk = __importStar(require("@reservoir0x/sdk"));
const axios_1 = __importDefault(require("axios"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const currencies_1 = require("@/utils/currencies");
const network_1 = require("@/config/network");
const USD_DECIMALS = 6;
// TODO: This should be a per-network setting
const NATIVE_UNIT = (0, utils_1.bn)("1000000000000000000");
const getUpstreamUSDPrice = async (currencyAddress, timestamp) => {
    var _a, _b, _c;
    try {
        const currency = await (0, currencies_1.getCurrency)(currencyAddress);
        const coingeckoCurrencyId = (_a = currency === null || currency === void 0 ? void 0 : currency.metadata) === null || _a === void 0 ? void 0 : _a.coingeckoCurrencyId;
        if (coingeckoCurrencyId) {
            const date = new Date(timestamp * 1000);
            const day = date.getDate();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const url = `https://api.coingecko.com/api/v3/coins/${coingeckoCurrencyId}/history?date=${day}-${month}-${year}`;
            logger_1.logger.info("prices", `Fetching price from Coingecko: ${url}`);
            const result = await axios_1.default.get(url, { timeout: 10 * 1000 }).then((response) => response.data);
            const usdPrice = (_c = (_b = result === null || result === void 0 ? void 0 : result.market_data) === null || _b === void 0 ? void 0 : _b.current_price) === null || _c === void 0 ? void 0 : _c["usd"];
            if (usdPrice) {
                const value = (0, units_1.parseUnits)(usdPrice.toFixed(USD_DECIMALS), USD_DECIMALS).toString();
                const truncatedTimestamp = Math.floor(date.valueOf() / 1000);
                await db_1.idb.none(`
            INSERT INTO usd_prices (
              currency,
              timestamp,
              value
            ) VALUES (
              $/currency/,
              date_trunc('day', to_timestamp($/timestamp/)),
              $/value/
            ) ON CONFLICT DO NOTHING
          `, {
                    currency: (0, utils_1.toBuffer)(currencyAddress),
                    timestamp: truncatedTimestamp,
                    value,
                });
                return {
                    currency: currencyAddress,
                    timestamp: truncatedTimestamp,
                    value,
                };
            }
        }
    }
    catch (error) {
        logger_1.logger.error("prices", `Failed to fetch upstream USD price for ${currencyAddress} and timestamp ${timestamp}: ${error}`);
    }
    return undefined;
};
const getCachedUSDPrice = async (currencyAddress, timestamp) => db_1.idb
    .oneOrNone(`
        SELECT
          extract('epoch' from usd_prices.timestamp) AS "timestamp",
          usd_prices.value
        FROM usd_prices
        WHERE usd_prices.currency = $/currency/
          AND usd_prices.timestamp <= date_trunc('day', to_timestamp($/timestamp/))
        ORDER BY usd_prices.timestamp DESC
        LIMIT 1
      `, {
    currency: (0, utils_1.toBuffer)(currencyAddress),
    timestamp,
})
    .then((data) => data
    ? {
        currency: currencyAddress,
        timestamp: data.timestamp,
        value: data.value,
    }
    : undefined)
    .catch(() => undefined);
const USD_PRICE_MEMORY_CACHE = new Map();
const getAvailableUSDPrice = async (currencyAddress, timestamp) => {
    // At the moment, we support day-level granularity for prices
    const DAY = 24 * 3600;
    const normalizedTimestamp = Math.floor(timestamp / DAY);
    const key = `${currencyAddress}-${normalizedTimestamp}`.toLowerCase();
    if (!USD_PRICE_MEMORY_CACHE.has(key)) {
        // If the price is not available in the memory cache, use any available database cached price
        let cachedPrice = await getCachedUSDPrice(currencyAddress, timestamp);
        if (
        // If the database cached price is not available
        !cachedPrice ||
            // Or if the database cached price is stale (older than what is requested)
            Math.floor(cachedPrice.timestamp / DAY) !== normalizedTimestamp) {
            // Then try to fetch the price from upstream
            const upstreamPrice = await getUpstreamUSDPrice(currencyAddress, timestamp);
            if (upstreamPrice) {
                cachedPrice = upstreamPrice;
            }
        }
        if (cachedPrice) {
            USD_PRICE_MEMORY_CACHE.set(key, cachedPrice);
        }
    }
    return USD_PRICE_MEMORY_CACHE.get(key);
};
const getUSDAndNativePrices = async (currencyAddress, price, timestamp, options) => {
    var _a;
    let usdPrice;
    let nativePrice;
    // Only try to get pricing data if the network supports it
    const force = index_1.config.chainId === 5 && currencyAddress === "0x2f3a40a3db8a7e3d09b0adfefbce4f6f81927557";
    if (((_a = (0, network_1.getNetworkSettings)().coingecko) === null || _a === void 0 ? void 0 : _a.networkId) || force) {
        const currencyUSDPrice = await getAvailableUSDPrice(currencyAddress, timestamp);
        let nativeUSDPrice;
        if (!(options === null || options === void 0 ? void 0 : options.onlyUSD)) {
            nativeUSDPrice = await getAvailableUSDPrice(constants_1.AddressZero, timestamp);
        }
        const currency = await (0, currencies_1.getCurrency)(currencyAddress);
        if (currency.decimals && currencyUSDPrice) {
            const currencyUnit = (0, utils_1.bn)(10).pow(currency.decimals);
            usdPrice = (0, utils_1.bn)(price).mul(currencyUSDPrice.value).div(currencyUnit).toString();
            if (nativeUSDPrice) {
                nativePrice = (0, utils_1.bn)(price)
                    .mul(currencyUSDPrice.value)
                    .mul(NATIVE_UNIT)
                    .div(nativeUSDPrice.value)
                    .div(currencyUnit)
                    .toString();
            }
        }
    }
    // Make sure to handle the case where the currency is the native one (or the wrapped equivalent)
    if ([Sdk.Common.Addresses.Eth[index_1.config.chainId], Sdk.Common.Addresses.Weth[index_1.config.chainId]].includes(currencyAddress)) {
        nativePrice = price;
    }
    return { usdPrice, nativePrice };
};
exports.getUSDAndNativePrices = getUSDAndNativePrices;
//# sourceMappingURL=index.js.map