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
exports.postInvalidateOrderOptions = void 0;
const Boom = __importStar(require("@hapi/boom"));
const joi_1 = __importDefault(require("joi"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const index_1 = require("@/config/index");
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
exports.postInvalidateOrderOptions = {
    description: "Invalidate an existing order.",
    tags: ["api", "x-admin"],
    validate: {
        headers: joi_1.default.object({
            "x-admin-api-key": joi_1.default.string().required(),
        }).options({ allowUnknown: true }),
        payload: joi_1.default.object({
            id: joi_1.default.string().required(),
        }),
    },
    handler: async (request) => {
        if (request.headers["x-admin-api-key"] !== index_1.config.adminApiKey) {
            throw Boom.unauthorized("Wrong or missing admin API key");
        }
        const payload = request.payload;
        try {
            await db_1.idb.none(`
          UPDATE orders SET
            fillability_status = 'cancelled',
            approval_status = 'disabled',
            updated_at = now()
          WHERE orders.id = $/id/
        `, { id: payload.id });
            // Recheck the order
            await orderUpdatesById.addToQueue([
                {
                    context: `revalidation-${Date.now()}-${payload.id}`,
                    id: payload.id,
                    trigger: {
                        kind: "revalidation",
                    },
                },
            ]);
            return { message: "Success" };
        }
        catch (error) {
            logger_1.logger.error("post-fix-orders-handler", `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=post-invalidate-order.js.map