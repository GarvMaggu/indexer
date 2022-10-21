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
exports.postTokenSetsV1Options = void 0;
const Boom = __importStar(require("@hapi/boom"));
const merkle_1 = require("@reservoir0x/sdk/dist/common/helpers/merkle");
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("@/common/logger");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const utils_2 = require("@/orderbook/orders/utils");
const tokenSet = __importStar(require("@/orderbook/token-sets"));
const version = "v1";
exports.postTokenSetsV1Options = {
    description: "Create Token Set",
    tags: ["api", "Tokens"],
    plugins: {
        "hapi-swagger": {
            order: 13,
        },
    },
    timeout: {
        server: 60 * 1000,
    },
    payload: {
        // 10 MB
        maxBytes: 1048576 * 10,
    },
    validate: {
        payload: joi_1.default.object({
            contract: joi_1.default.string()
                .lowercase()
                .pattern(utils_1.regex.address)
                .description("Contract address. Example: `0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63`")
                .required(),
            tokenIds: joi_1.default.array().items(joi_1.default.string().lowercase().pattern(/^\d+$/)).required(),
        }),
    },
    response: {
        schema: joi_1.default.object({
            id: joi_1.default.string(),
        }).label(`postTokenSets${version.toUpperCase()}Response`),
        failAction: (_request, _h, error) => {
            logger_1.logger.error(`post-token-sets-${version}-handler`, `Wrong response schema: ${error}`);
            throw error;
        },
    },
    handler: async (request) => {
        const payload = request.payload;
        try {
            const contract = payload.contract;
            const tokenIds = payload.tokenIds;
            if (tokenIds.length <= 1) {
                throw Boom.badRequest("Token sets should contain at least 2 tokens");
            }
            if (tokenIds.length > index_1.config.maxTokenSetSize) {
                throw Boom.badRequest("Token sets are restricted to at most 10000 tokens");
            }
            const merkleTree = (0, merkle_1.generateMerkleTree)(tokenIds);
            const ts = await tokenSet.tokenList.save([
                {
                    id: `list:${contract}:${merkleTree.getHexRoot()}`,
                    schemaHash: (0, utils_2.generateSchemaHash)(undefined),
                    items: {
                        contract,
                        tokenIds,
                    },
                },
            ]);
            if (ts.length !== 1) {
                throw Boom.internal("Could not save token set");
            }
            return { id: ts[0].id };
        }
        catch (error) {
            logger_1.logger.error(`post-token-sets-${version}-handler`, `Handler failure: ${error}`);
            throw error;
        }
    },
};
//# sourceMappingURL=v1.js.map