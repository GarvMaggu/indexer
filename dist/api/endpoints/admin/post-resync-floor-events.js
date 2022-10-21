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
exports.postResyncFloorEventsOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const p_limit_1 = __importDefault(require("p-limit"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
exports.postResyncFloorEventsOptions = {
    description: "Trigger fixing any floor events inconsistencies for any particular collection.",
    tags: ["api", "x-admin"],
    timeout: {
        server: 5 * 60 * 1000,
    },
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            collection: joi_1.default.string(),
            token: joi_1.default.string()
                .lowercase()
                .pattern(/^0x[a-fA-F0-9]{40}:[0-9]+$/),
        })
            .or("collection", "token")
            .oxor("collection", "token"),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            const handleToken = async (contract, tokenId) => {
                const tokenCacheResult = await db_1.redb.oneOrNone(`
            SELECT
              tokens.floor_sell_id,
              tokens.floor_sell_value
            FROM tokens
            WHERE tokens.contract = $/contract/
              AND tokens.token_id = $/tokenId/
          `, {
                    contract: (0, utils_1.toBuffer)(contract),
                    tokenId,
                });
                const latestEventResult = await db_1.redb.oneOrNone(`
            SELECT
              token_floor_sell_events.order_id,
              token_floor_sell_events.price
            FROM token_floor_sell_events
            WHERE token_floor_sell_events.contract = $/contract/
              AND token_floor_sell_events.token_id = $/tokenId/
            ORDER BY token_floor_sell_events.created_at DESC
            LIMIT 1
          `, {
                    contract: (0, utils_1.toBuffer)(contract),
                    tokenId,
                });
                const floorMatches = tokenCacheResult.floor_sell_value == (latestEventResult === null || latestEventResult === void 0 ? void 0 : latestEventResult.price);
                if (!floorMatches) {
                    await db_1.idb.none(`
              WITH x AS (
                SELECT
                  orders.id,
                  orders.maker,
                  orders.price,
                  orders.source_id_int,
                  orders.valid_between,
                  orders.nonce
                FROM tokens
                LEFT JOIN orders
                  ON tokens.floor_sell_id = orders.id
                WHERE tokens.contract = $/contract/
                  AND tokens.token_id = $/tokenId/
              )
              INSERT INTO token_floor_sell_events(
                kind,
                contract,
                token_id,
                order_id,
                maker,
                price,
                source_id_int,
                valid_between,
                nonce,
                previous_price
              )
              SELECT
                'revalidation',
                $/contract/,
                $/tokenId/,
                x.id,
                x.maker,
                x.price,
                x.source_id_int,
                x.valid_between,
                x.nonce,
                $/previousPrice/
              FROM x
            `, {
                        contract: (0, utils_1.toBuffer)(contract),
                        tokenId,
                        previousPrice: (latestEventResult === null || latestEventResult === void 0 ? void 0 : latestEventResult.price) || null,
                    });
                }
            };
            if (payload.token) {
                const [contract, tokenId] = payload.token.split(":");
                await handleToken(contract, tokenId);
            }
            else if (payload.collection) {
                const tokens = await db_1.redb.manyOrNone(`
            SELECT
              tokens.contract,
              tokens.token_id
            FROM tokens
            WHERE tokens.collection_id = $/collection/
            LIMIT 10000
          `, { collection: payload.collection });
                if (tokens) {
                    const limit = (0, p_limit_1.default)(20);
                    await Promise.all(tokens.map(({ contract, token_id }) => limit(() => handleToken((0, utils_1.fromBuffer)(contract), token_id))));
                }
            }
            return { message: "Success" };
        }
        catch (error) {
            logger_1.logger.error("post-fix-token-cache-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-resync-floor-events.js.map