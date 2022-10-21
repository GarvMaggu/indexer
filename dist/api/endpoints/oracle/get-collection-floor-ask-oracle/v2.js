"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
exports.getCollectionFloorAskOracleV2Options = void 0;
const abi_1 = require("@ethersproject/abi");
const bytes_1 = require("@ethersproject/bytes");
const constants_1 = require("@ethersproject/constants");
const hash_1 = require("@ethersproject/hash");
const wallet_1 = require("@ethersproject/wallet");
const Boom = __importStar(require("@hapi/boom"));
const Sdk = __importStar(require("@reservoir0x/sdk"));
const axios_1 = __importDefault(require("axios"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const version = "v2";
exports.getCollectionFloorAskOracleV2Options = {
    description: "Collection floor",
    notes: "Get a signed message of any collection's floor price (spot or twap). The oracle signer address is 0x32da57e736e05f75aa4fae2e9be60fd904492726.",
    tags: ["api", "x-deprecated"],
    plugins: {
        "hapi-swagger": {
            order: 12,
        },
    },
    validate: {
        params: joi_1.default.object({
            collection: joi_1.default.string().lowercase().required(),
        }),
        query: joi_1.default.object({
            kind: joi_1.default.string().valid("spot", "twap", "lower", "upper").default("spot"),
            currency: joi_1.default.string().lowercase().default(constants_1.AddressZero),
            twapHours: joi_1.default.number().default(24),
            eip3668Calldata: joi_1.default.string(),
        }),
    },
    response: {
        schema: joi_1.default.object({
            price: joi_1.default.number().unsafe().required(),
            message: joi_1.default.object({
                id: joi_1.default.string().required(),
                payload: joi_1.default.string().required(),
                timestamp: joi_1.default.number().required(),
                signature: joi_1.default.string().required(),
            }),
            data: joi_1.default.string(),
        }).label(`getCollectionFloorAskOracle${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`get-collection-floor-ask-oracle-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const query = request.query;
        const params = request.params;
        if (query.eip3668Calldata) {
            const [currency, kind] = abi_1.defaultAbiCoder.decode(["address", "string"], query.eip3668Calldata);
            query.currency = currency.toLowerCase();
            query.kind = kind;
        }
        try {
            const spotQuery = `
        SELECT
          collection_floor_sell_events.price
        FROM collection_floor_sell_events
        WHERE collection_floor_sell_events.collection_id = $/collection/
        ORDER BY collection_floor_sell_events.created_at DESC
        LIMIT 1
      `;
            const twapQuery = `
        WITH
          x AS (
            SELECT
              *
            FROM collection_floor_sell_events
            WHERE collection_floor_sell_events.collection_id = $/collection/
              AND collection_floor_sell_events.created_at >= now() - interval '${query.twapHours} hours'
            ORDER BY collection_floor_sell_events.created_at
          ),
          y AS (
            SELECT
              *
            FROM collection_floor_sell_events
            WHERE collection_floor_sell_events.collection_id = $/collection/
              AND collection_floor_sell_events.created_at < (SELECT COALESCE(MIN(x.created_at), 'Infinity') FROM x)
            ORDER BY collection_floor_sell_events.created_at DESC
            LIMIT 1
          ),
          z AS (
            SELECT * FROM x
            UNION ALL
            SELECT * FROM y
          ),
          w AS (
            SELECT
              price,
              floor(extract('epoch' FROM greatest(z.created_at, now() - interval '${query.twapHours} hours'))) AS start_time,
              floor(extract('epoch' FROM coalesce(lead(z.created_at, 1) OVER (ORDER BY created_at), now()))) AS end_time
            FROM z
          )
          SELECT
            floor(
              SUM(w.price * (w.end_time - w.start_time)) / (MAX(w.end_time) - MIN(w.start_time))
            )::NUMERIC(78, 0) AS price
          FROM w
      `;
            let PriceKind;
            (function (PriceKind) {
                PriceKind[PriceKind["SPOT"] = 0] = "SPOT";
                PriceKind[PriceKind["TWAP"] = 1] = "TWAP";
                PriceKind[PriceKind["LOWER"] = 2] = "LOWER";
                PriceKind[PriceKind["UPPER"] = 3] = "UPPER";
            })(PriceKind || (PriceKind = {}));
            let kind;
            let price;
            let decimals = 18;
            if (query.kind === "spot") {
                const result = await db_1.redb.oneOrNone(spotQuery, params);
                if (!(result === null || result === void 0 ? void 0 : result.price)) {
                    throw Boom.badRequest("No floor ask price available");
                }
                kind = PriceKind.SPOT;
                price = result.price;
            }
            else if (query.kind === "twap") {
                const result = await db_1.redb.oneOrNone(twapQuery, params);
                if (!(result === null || result === void 0 ? void 0 : result.price)) {
                    throw Boom.badRequest("No floor ask price available");
                }
                kind = PriceKind.TWAP;
                price = result.price;
            }
            else {
                const spotResult = await db_1.redb.oneOrNone(spotQuery, params);
                const twapResult = await db_1.redb.oneOrNone(twapQuery, params);
                if (!(spotResult === null || spotResult === void 0 ? void 0 : spotResult.price) || !(twapResult === null || twapResult === void 0 ? void 0 : twapResult.price)) {
                    throw Boom.badRequest("No floor ask price available");
                }
                if (query.kind === "lower") {
                    kind = PriceKind.LOWER;
                    price = (0, utils_1.bn)(spotResult.price).lt(twapResult.price) ? spotResult.price : twapResult.price;
                }
                else {
                    kind = PriceKind.UPPER;
                    price = (0, utils_1.bn)(spotResult.price).gt(twapResult.price) ? spotResult.price : twapResult.price;
                }
            }
            // Use EIP-712 structured hashing (https://eips.ethereum.org/EIPS/eip-712)
            const EIP712_TYPES = {
                Message: {
                    Message: [
                        { name: "id", type: "bytes32" },
                        { name: "payload", type: "bytes" },
                        { name: "timestamp", type: "uint256" },
                    ],
                },
                ContractWideCollectionPrice: {
                    ContractWideCollectionPrice: [
                        { name: "kind", type: "uint8" },
                        { name: "twapHours", type: "uint256" },
                        { name: "contract", type: "address" },
                    ],
                },
                TokenRangeCollectionPrice: {
                    TokenRangeCollectionPrice: [
                        { name: "kind", type: "uint8" },
                        { name: "twapHours", type: "uint256" },
                        { name: "startTokenId", type: "uint256" },
                        { name: "endTokenId", type: "uint256" },
                    ],
                },
            };
            let id;
            if (params.collection.includes(":")) {
                const [contract, startTokenId, endTokenId] = params.collection.split(":");
                id = hash_1._TypedDataEncoder.hashStruct("TokenRangeCollectionPrice", EIP712_TYPES.TokenRangeCollectionPrice, {
                    kind,
                    twapHours: query.twapHours,
                    contract,
                    startTokenId,
                    endTokenId,
                });
            }
            else {
                id = hash_1._TypedDataEncoder.hashStruct("ContractWideCollectionPrice", EIP712_TYPES.ContractWideCollectionPrice, {
                    kind,
                    twapHours: query.twapHours,
                    contract: params.collection,
                });
            }
            if (Object.values(Sdk.Common.Addresses.Eth).includes(query.currency)) {
                // ETH: do nothing
            }
            else if (Object.values(Sdk.Common.Addresses.Weth).includes(query.currency)) {
                // WETH: do nothing
            }
            else if (Object.values(Sdk.Common.Addresses.Usdc).includes(query.currency)) {
                // USDC: convert price to USDC
                const usdPrice = await axios_1.default
                    .get("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
                    .then((response) => response.data.ethereum.usd);
                // USDC has 6 decimals
                price = (0, utils_1.bn)(Math.floor(usdPrice * 1000000))
                    .mul(price)
                    .div((0, utils_1.bn)("1000000000000000000"))
                    .toString();
                decimals = 6;
            }
            else {
                throw Boom.badRequest("Unsupported currency");
            }
            const message = {
                id,
                payload: abi_1.defaultAbiCoder.encode(["address", "uint256"], [query.currency, price]),
                timestamp: (0, utils_1.now)(),
            };
            if (index_1.config.oraclePrivateKey) {
                message.signature = await new wallet_1.Wallet(index_1.config.oraclePrivateKey).signMessage((0, bytes_1.arrayify)(hash_1._TypedDataEncoder.hashStruct("Message", EIP712_TYPES.Message, message)));
            }
            else {
                throw Boom.badRequest("Instance cannot act as oracle");
            }
            return {
                price: (0, utils_1.formatPrice)(price, decimals),
                message,
                // For EIP-3668 compatibility
                data: abi_1.defaultAbiCoder.encode(["(bytes32 id, bytes payload, uint256 timestamp, bytes signature)"], [message]),
            };
        }
        catch (error) {
            logger_1.logger.error(`get-collection-floor-ask-oracle-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v2.js.map