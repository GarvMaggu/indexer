"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributesEntity = void 0;
class AttributesEntity {
    constructor(params) {
        this.id = params.id;
        this.attributeKeyId = params.attribute_key_id;
        this.value = params.value;
        this.tokenCount = params.token_count;
        this.onSaleCount = params.on_sale_count;
        this.floorSellValue = params.floor_sell_value;
        this.topBuyValue = params.top_buy_value;
        this.sellUpdatedAt = params.sell_updated_at;
        this.buyUpdatedAt = params.buy_updated_at;
        this.collectionId = params.collection_id;
        this.kind = params.kind;
        this.key = params.key;
    }
}
exports.AttributesEntity = AttributesEntity;
//# sourceMappingURL=attributes-entity.js.map