"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivitiesEntity = exports.ActivityType = void 0;
const utils_1 = require("@/common/utils");
var ActivityType;
(function (ActivityType) {
    ActivityType["sale"] = "sale";
    ActivityType["ask"] = "ask";
    ActivityType["transfer"] = "transfer";
    ActivityType["mint"] = "mint";
    ActivityType["bid"] = "bid";
    ActivityType["bid_cancel"] = "bid_cancel";
    ActivityType["ask_cancel"] = "ask_cancel";
})(ActivityType = exports.ActivityType || (exports.ActivityType = {}));
class ActivitiesEntity {
    constructor(params) {
        var _a;
        this.id = params.id;
        this.hash = params.hash;
        this.type = params.type;
        this.contract = (0, utils_1.fromBuffer)(params.contract);
        this.collectionId = params.collection_id;
        this.tokenId = params.token_id;
        this.orderId = params.order_id;
        this.fromAddress = (0, utils_1.fromBuffer)(params.from_address);
        this.toAddress = params.to_address ? (0, utils_1.fromBuffer)(params.to_address) : null;
        this.price = params.price;
        this.amount = Number(params.amount);
        this.blockHash = params.block_hash ? (0, utils_1.fromBuffer)(params.block_hash) : null;
        this.eventTimestamp = params.event_timestamp;
        this.createdAt = params.created_at;
        this.metadata = params.metadata;
        this.token = {
            tokenId: params.token_id,
            tokenImage: params.token_image,
            tokenName: params.token_name,
        };
        this.collection = {
            collectionId: params.collection_id,
            collectionImage: (_a = params.collection_metadata) === null || _a === void 0 ? void 0 : _a.imageUrl,
            collectionName: params.collection_name,
        };
        this.order = {
            id: params.order_id,
            side: params.order_side,
            sourceIdInt: params.order_source_id_int,
            kind: params.order_kind,
        };
    }
}
exports.ActivitiesEntity = ActivitiesEntity;
//# sourceMappingURL=activities-entity.js.map