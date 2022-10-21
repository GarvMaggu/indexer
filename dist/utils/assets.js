"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Assets = void 0;
const lodash_1 = __importDefault(require("lodash"));
const index_1 = require("@/config/index");
const utils_1 = require("@/common/utils");
class Assets {
    static getLocalAssetsLink(assets) {
        if (lodash_1.default.isEmpty(assets) || assets == "") {
            return undefined;
        }
        const baseUrl = `https://api${index_1.config.chainId == 1 ? "" : "-goerli"}.reservoir.tools/assets/v1?`;
        if (lodash_1.default.isArray(assets)) {
            const assetsResult = [];
            for (const asset of assets) {
                const queryParams = new URLSearchParams();
                queryParams.append("asset", (0, utils_1.encrypt)(asset));
                assetsResult.push(`${baseUrl}${queryParams.toString()}`);
            }
            return assetsResult;
        }
        else {
            const queryParams = new URLSearchParams();
            queryParams.append("asset", (0, utils_1.encrypt)(assets));
            return `${baseUrl}${queryParams.toString()}`;
        }
    }
}
exports.Assets = Assets;
//# sourceMappingURL=assets.js.map