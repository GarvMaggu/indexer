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
exports.getOrderExecutedV1Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const version = "v1";
exports.getOrderExecutedV1Options = {
    description: "Order status",
    tags: ["api", "Router"],
    plugins: {
        "hapi-swagger": {
            order: 5,
        },
    },
    validate: {
        query: joi_1.default.object({
            ids: joi_1.default.alternatives(joi_1.default.array().items(joi_1.default.string()), joi_1.default.string()).required(),
        }),
    },
    handler: async (request) => {
        const query = request.query;
        // Ensure `query.ids` is an array
        if (!Array.isArray(query.ids)) {
            query.ids = [query.ids];
        }
        try {
            const data = await db_1.redb.manyOrNone(`
          SELECT
            orders.id,
            orders.fillability_status,
            orders.token_set_id,
            fill_events_2.amount,
            fill_events_2.taker
          FROM orders
          LEFT JOIN fill_events_2
            ON fill_events_2.order_id = orders.id
            AND fill_events_2.timestamp > floor(extract(epoch FROM now() - interval '5 minutes'))::INT
          WHERE orders.id IN ($/ids:csv/)
        `, { ids: query.ids });
            const result = data.map(({ id, fillability_status, token_set_id, amount, taker }) => ({
                id: id,
                status: ["cancelled", "filled"].includes(fillability_status) ? "executed" : "fillable",
                tokenSetId: token_set_id,
                filledAmount: amount,
                filledBy: taker ? (0, utils_1.fromBuffer)(taker) : null,
            }));
            if (!result.some(({ status, filledBy }) => status === "executed" || Boolean(filledBy))) {
                throw Boom.badData("Orders not recently executed");
            }
            return { orders: result };
        }
        catch (error) {
            logger_1.logger.error(`get-order-executed-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map