"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJoiPriceObject = exports.getJoiAmountObject = exports.JoiPrice = void 0;
const joi_1 = __importDefault(require("joi"));
const utils_1 = require("@/common/utils");
const currencies_1 = require("@/utils/currencies");
const prices_1 = require("@/utils/prices");
// --- Prices ---
const JoiPriceAmount = joi_1.default.object({
    raw: joi_1.default.string().pattern(utils_1.regex.number),
    decimal: joi_1.default.number().unsafe(),
    usd: joi_1.default.number().unsafe().allow(null),
    native: joi_1.default.number().unsafe(),
});
const JoiPriceCurrency = joi_1.default.object({
    contract: joi_1.default.string().pattern(utils_1.regex.address),
    name: joi_1.default.string(),
    symbol: joi_1.default.string(),
    decimals: joi_1.default.number(),
});
exports.JoiPrice = joi_1.default.object({
    currency: JoiPriceCurrency,
    amount: JoiPriceAmount,
    netAmount: JoiPriceAmount.optional(),
});
const getJoiAmountObject = async (currency, amount, nativeAmount, usdAmount) => {
    let usdPrice = usdAmount;
    if (amount && !usdPrice) {
        usdPrice = (await (0, prices_1.getUSDAndNativePrices)(currency.contract, amount, (0, utils_1.now)(), {
            onlyUSD: true,
        })).usdPrice;
    }
    return {
        raw: amount,
        decimal: (0, utils_1.formatPrice)(amount, currency.decimals),
        usd: usdPrice ? (0, utils_1.formatUsd)(usdPrice) : null,
        native: (0, utils_1.formatEth)(nativeAmount),
    };
};
exports.getJoiAmountObject = getJoiAmountObject;
const getJoiPriceObject = async (prices, currencyAddress) => {
    const currency = await (0, currencies_1.getCurrency)(currencyAddress);
    return {
        currency: {
            contract: currency.contract,
            name: currency.name,
            symbol: currency.symbol,
            decimals: currency.decimals,
        },
        amount: await (0, exports.getJoiAmountObject)(currency, prices.gross.amount, prices.gross.nativeAmount, prices.gross.usdAmount),
        netAmount: prices.net &&
            (await (0, exports.getJoiAmountObject)(currency, prices.net.amount, prices.net.nativeAmount, prices.net.usdAmount)),
    };
};
exports.getJoiPriceObject = getJoiPriceObject;
//# sourceMappingURL=joi.js.map