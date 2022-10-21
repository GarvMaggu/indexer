"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.OpenseaIndexerApi = void 0;
const config_1 = require("../config");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("@/common/logger");
class OpenseaIndexerApi {
    static async fastTokenSync(token) {
        return await axios_1.default
            .post(`${config_1.config.openseaIndexerApiBaseUrl}/fast-token-sync`, { token }, { timeout: 60000 })
            .catch((error) => {
            logger_1.logger.error("fast_token_sync", `Failed to sync token=${token}, error=${error}`);
            return false;
        });
    }
    static async fastContractSync(contract) {
        return await axios_1.default
            .post(`${config_1.config.openseaIndexerApiBaseUrl}/fast-contract-sync`, { contract }, { timeout: 60000 })
            .catch((error) => {
            logger_1.logger.error("fast_token_sync", `Failed to sync contract=${contract}, error=${error}`);
            return false;
        });
    }
}
exports.OpenseaIndexerApi = OpenseaIndexerApi;
exports.default = OpenseaIndexerApi;
//# sourceMappingURL=opensea-indexer-api.js.map