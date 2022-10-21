"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSchemaHash = void 0;
const constants_1 = require("@ethersproject/constants");
const crypto_1 = __importDefault(require("crypto"));
const json_stable_stringify_1 = __importDefault(require("json-stable-stringify"));
const defaultSchemaHash = constants_1.HashZero;
const generateSchemaHash = (schema) => schema
    ? "0x" + crypto_1.default.createHash("sha256").update((0, json_stable_stringify_1.default)(schema)).digest("hex")
    : defaultSchemaHash;
exports.generateSchemaHash = generateSchemaHash;
//# sourceMappingURL=utils.js.map