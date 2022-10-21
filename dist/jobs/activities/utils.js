"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBidInfoByOrderId = exports.getActivityHash = void 0;
const crypto_1 = __importDefault(require("crypto"));
const db_1 = require("@/common/db");
const tokens_1 = require("@/models/tokens");
const attributes_1 = require("@/models/attributes");
const collections_1 = require("@/models/collections");
function getActivityHash(...params) {
    return crypto_1.default
        .createHash("sha256")
        .update(`${params.join("")}`)
        .digest("hex");
}
exports.getActivityHash = getActivityHash;
async function getBidInfoByOrderId(orderId) {
    let tokenId;
    let collectionId;
    const tokenSetByOrderIdResult = await db_1.redb.oneOrNone(`
                SELECT
                  ts.id,
                  ts.attribute_id
                FROM orders
                JOIN token_sets ts
                  ON orders.token_set_id = ts.id
                WHERE orders.id = $/orderId/
                LIMIT 1
            `, {
        orderId: orderId,
    });
    if (tokenSetByOrderIdResult.id.startsWith("token:")) {
        let contract;
        [, contract, tokenId] = tokenSetByOrderIdResult.id.split(":");
        const token = await tokens_1.Tokens.getByContractAndTokenId(contract, tokenId, true);
        collectionId = token === null || token === void 0 ? void 0 : token.collectionId;
    }
    else if (tokenSetByOrderIdResult.id.startsWith("list:")) {
        const attribute = await attributes_1.Attributes.getById(tokenSetByOrderIdResult.attribute_id);
        collectionId = attribute === null || attribute === void 0 ? void 0 : attribute.collectionId;
    }
    else if (tokenSetByOrderIdResult.id.startsWith("range:")) {
        const collection = await collections_1.Collections.getByTokenSetId(tokenSetByOrderIdResult.id);
        collectionId = collection === null || collection === void 0 ? void 0 : collection.id;
    }
    else {
        [, collectionId] = tokenSetByOrderIdResult.id.split(":");
    }
    return [collectionId, tokenId, tokenSetByOrderIdResult.attribute_id];
}
exports.getBidInfoByOrderId = getBidInfoByOrderId;
//# sourceMappingURL=utils.js.map