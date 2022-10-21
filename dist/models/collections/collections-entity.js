"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionsEntity = void 0;
const utils_1 = require("@/common/utils");
class CollectionsEntity {
    constructor(params) {
        this.id = params.id;
        this.slug = params.slug;
        this.name = params.name;
        this.metadata = params.metadata;
        this.royalties = params.royalties ? params.royalties : [];
        this.community = params.community;
        this.contract = (0, utils_1.fromBuffer)(params.contract);
        this.tokenIdRange = params.token_id_range != "(,)" ? JSON.parse(params.token_id_range) : [];
        this.tokenSetId = params.token_set_id;
        this.nonFlaggedTokenSetId = params.non_flagged_token_set_id;
        this.tokenCount = params.token_count;
        this.createdAt = params.created_at;
        this.updatedAt = params.updated_at;
        this.day1Volume = params.day1_volume;
        this.day1Rank = params.day1_rank;
        this.day7Volume = params.day7_volume;
        this.day7Rank = params.day7_rank;
        this.day30Volume = params.day30_volume;
        this.day30Rank = params.day30_rank;
        this.allTimeVolume = params.all_time_volume;
        this.allTimeRank = params.all_time_rank;
        this.indexMetadata = params.index_metadata;
        this.lastMetadataSync = params.last_metadata_sync;
        this.mintedTimestamp = params.minted_timestamp;
        this.floorSellValue = params.floor_sell_value;
    }
}
exports.CollectionsEntity = CollectionsEntity;
//# sourceMappingURL=collections-entity.js.map