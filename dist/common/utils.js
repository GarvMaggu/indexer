"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.regex = exports.buildContinuation = exports.splitContinuation = exports.concat = exports.now = exports.toBuffer = exports.fromBuffer = exports.decrypt = exports.encrypt = exports.getNetAmount = exports.formatPrice = exports.formatUsd = exports.formatEth = exports.bn = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const units_1 = require("@ethersproject/units");
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("@/config/index");
// --- BigNumbers ---
const bn = (value) => bignumber_1.BigNumber.from(value);
exports.bn = bn;
// --- Prices ---
const formatEth = (value) => Number(Number((0, units_1.formatEther)(value)).toFixed(5));
exports.formatEth = formatEth;
const formatUsd = (value) => Number(Number((0, units_1.formatUnits)(value, 6)).toFixed(5));
exports.formatUsd = formatUsd;
const formatPrice = (value, decimals = 18) => Number(Number((0, units_1.formatUnits)(value, decimals)).toFixed(5));
exports.formatPrice = formatPrice;
const getNetAmount = (value, bps) => (0, exports.bn)(value).sub((0, exports.bn)(value).mul(bps).div(10000)).toString();
exports.getNetAmount = getNetAmount;
// --- Encrypt / Decrypt ---
const encrypt = (text) => {
    const cipher = crypto_1.default.createCipheriv("aes-256-ecb", index_1.config.cipherSecret, null);
    const encryptedText = Buffer.concat([cipher.update(text), cipher.final()]);
    return encryptedText.toString("hex");
};
exports.encrypt = encrypt;
const decrypt = (text) => {
    const decipher = crypto_1.default.createDecipheriv("aes-256-ecb", index_1.config.cipherSecret, null);
    const decryptedAsset = Buffer.concat([
        decipher.update(Buffer.from(text, "hex")),
        decipher.final(),
    ]);
    return decryptedAsset.toString();
};
exports.decrypt = decrypt;
// --- Buffers ---
const fromBuffer = (buffer) => "0x" + buffer.toString("hex");
exports.fromBuffer = fromBuffer;
const toBuffer = (hexValue) => Buffer.from(hexValue.slice(2), "hex");
exports.toBuffer = toBuffer;
// --- Time ---
const now = () => Math.floor(Date.now() / 1000);
exports.now = now;
// --- Misc ---
const concat = (...items) => {
    let result = [];
    for (const item of items) {
        result = [...result, ...(item !== null && item !== void 0 ? item : [])];
    }
    return result;
};
exports.concat = concat;
// --- Continuations ---
const splitContinuation = (c, regEx) => {
    if (c.includes("_")) {
        return c.split("_");
    }
    c = decodeURIComponent(c);
    if (c.match(exports.regex.base64)) {
        const decoded = Buffer.from(c, "base64").toString("ascii");
        if (regEx && decoded.match(regEx)) {
            return decoded.split("_");
        }
        else {
            return [decoded];
        }
    }
    else {
        return [c];
    }
};
exports.splitContinuation = splitContinuation;
const buildContinuation = (c) => Buffer.from(c).toString("base64");
exports.buildContinuation = buildContinuation;
// --- Regex ---
exports.regex = {
    base64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    domain: /^[a-zA-Z0-9.-]+\.[a-zA-Z0-9]{2,}$/,
    address: /^0x[a-fA-F0-9]{40}$/,
    bytes32: /^0x[a-fA-F0-9]{64}$/,
    token: /^0x[a-fA-F0-9]{40}:[0-9]+$/,
    fee: /^0x[a-fA-F0-9]{40}:[0-9]+$/,
    number: /^[0-9]+$/,
    unixTimestamp: /^[0-9]{10}$/,
};
//# sourceMappingURL=utils.js.map