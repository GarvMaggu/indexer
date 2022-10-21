"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSimulateFloorV1Options = void 0;
const joi_1 = __importDefault(require("joi"));
const index_1 = require("@/api/index");
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_2 = require("@/config/index");
const simulation_1 = require("@/utils/simulation");
const version = "v1";
exports.postSimulateFloorV1Options = {
    description: "Simulate the floor ask of any token",
    tags: ["api", "Management"],
    plugins: {
        "hapi-swagger": {
            order: 13,
        },
    },
    timeout: {
        server: 2 * 60 * 1000,
    },
    validate: {
        payload: joi_1.default.object({
            token: joi_1.default.string().lowercase().pattern(utils_1.regex.token),
        }),
    },
    response: {
        schema: joi_1.default.object({
            message: joi_1.default.string(),
        }).label(`postSimulateFloor${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`post-simulate-floor-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const payload = request.payload;
        const invalidateOrder = async (orderId) => {
            logger_1.logger.warn(`post-simulate-floor-${version}-handler`, `Detected unfillable order ${orderId}`);
            // Invalidate the order if the simulation failed
            await (0, index_1.inject)({
                method: "POST",
                url: `/admin/invalidate-order`,
                headers: {
                    "Content-Type": "application/json",
                    "X-Admin-Api-Key": index_2.config.adminApiKey,
                },
                payload: {
                    id: orderId,
                },
            });
        };
        try {
            const token = payload.token;
            const response = await (0, index_1.inject)({
                method: "GET",
                url: `/execute/buy/v2?token=${token}&taker=${simulation_1.genericTaker}&skipBalanceCheck=true`,
                headers: {
                    "Content-Type": "application/json",
                },
            });
            if (JSON.parse(response.payload).statusCode === 500) {
                const floorAsk = await db_1.redb.oneOrNone(`
            SELECT
              tokens.floor_sell_id
            FROM tokens
            LEFT JOIN orders
              ON tokens.floor_sell_id = orders.id
            WHERE tokens.contract = $/contract/
              AND tokens.token_id = $/tokenId/
              AND orders.kind = 'x2y2'
          `, {
                    contract: (0, utils_1.toBuffer)(token.split(":")[0]),
                    tokenId: token.split(":")[1],
                });
                // If the "/execute/buy" API failed, most of the time it's because of
                // failing to generate the fill signature for X2Y2 orders since their
                // backend sees that particular order as unfillable (usually it's off
                // chain cancelled). In those cases, we cancel the floor ask order.
                if (floorAsk === null || floorAsk === void 0 ? void 0 : floorAsk.floor_sell_id) {
                    await invalidateOrder(floorAsk.floor_sell_id);
                    return { message: "Floor order is not fillable (got invalidated)" };
                }
            }
            if (response.payload.includes("No available orders")) {
                return { message: "No orders to simulate" };
            }
            // HACK: Extract the corresponding order id via regex
            // TODO: Once we switch to the v3 APIs we should get the order ids from the path
            const { groups } = /\?ids=(?<orderId>0x[0-9a-f]{64})/.exec(response.payload);
            const contractResult = await db_1.redb.one(`
          SELECT
            contracts.kind
          FROM contracts
          WHERE contracts.address = $/contract/
        `, { contract: (0, utils_1.toBuffer)(token.split(":")[0]) });
            const parsedPayload = JSON.parse(response.payload);
            const success = await (0, simulation_1.ensureBuyTxSucceeds)({
                kind: contractResult.kind,
                contract: parsedPayload.path[0].contract,
                tokenId: parsedPayload.path[0].tokenId,
                amount: parsedPayload.path[0].quantity,
            }, parsedPayload.steps[0].data);
            if (success) {
                return { message: "Floor order is fillable" };
            }
            else {
                await invalidateOrder(groups.orderId);
                return { message: "Floor order is not fillable (got invalidated)" };
            }
        }
        catch (error) {
            logger_1.logger.error(`post-simulate-floor-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map