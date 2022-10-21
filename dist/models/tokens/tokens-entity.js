"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokensEntity = void 0;
const utils_1 = require("@/common/utils");
class TokensEntity {
    constructor(params) {
        this.contract = (0, utils_1.fromBuffer)(params.contract);
        this.tokenId = params.token_id;
        this.name = params.name;
        this.description = params.description;
        this.image = params.image;
        this.collectionId = params.collection_id;
        this.metadataIndexed = params.metadata_indexed;
        this.floorSellId = params.floor_sell_id;
        this.floorSellValue = params.floor_sell_value;
        this.floorSellMaker = params.floor_sell_maker
            ? (0, utils_1.fromBuffer)(params.floor_sell_maker)
            : params.floor_sell_maker;
        this.topBuyId = params.top_buy_id;
        this.topBuyValue = params.top_buy_value;
        this.topBuyMaker = params.top_buy_maker
            ? (0, utils_1.fromBuffer)(params.top_buy_maker)
            : params.top_buy_maker;
        this.lastSellTimestamp = params.last_sell_timestamp;
        this.lastSellValue = params.last_sell_value;
        this.lastBuyTimestamp = params.last_buy_timestamp;
        this.lastBuyValue = params.last_buy_value;
        this.createdAt = params.created_at;
        this.updatedAt = params.updated_at;
        this.attributes = params.attributes ? (0, utils_1.fromBuffer)(params.attributes) : params.attributes;
        this.lastMetadataSync = params.last_metadata_sync;
        this.isFlagged = Number(params.is_flagged);
        this.lastFlagUpdate = params.last_flag_update;
    }
}
exports.TokensEntity = TokensEntity;
//# sourceMappingURL=tokens-entity.js.map