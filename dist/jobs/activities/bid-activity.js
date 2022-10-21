"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BidActivity = void 0;
const activities_entity_1 = require("@/models/activities/activities-entity");
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = require("@/common/logger");
const activities_1 = require("@/models/activities");
const utils_1 = require("@/jobs/activities/utils");
const user_activities_1 = require("@/models/user-activities");
class BidActivity {
    static async handleEvent(data) {
        const [collectionId, tokenId] = await (0, utils_1.getBidInfoByOrderId)(data.orderId);
        // If no collection found
        if (!collectionId) {
            logger_1.logger.warn("bid-activity", `No collection found for ${JSON.stringify(data)}`);
        }
        const activityHash = (0, utils_1.getActivityHash)(activities_entity_1.ActivityType.bid, data.orderId);
        const activity = {
            type: activities_entity_1.ActivityType.bid,
            hash: activityHash,
            contract: data.contract,
            collectionId: collectionId,
            tokenId: tokenId,
            orderId: data.orderId,
            fromAddress: data.maker,
            toAddress: null,
            price: data.price,
            amount: data.amount,
            blockHash: null,
            eventTimestamp: data.timestamp,
            metadata: {
                orderId: data.orderId,
                orderSourceIdInt: data.orderSourceIdInt,
            },
        };
        // One record for the user to address, One record for the user from address
        const fromUserActivity = lodash_1.default.clone(activity);
        fromUserActivity.address = data.maker;
        await Promise.all([
            activities_1.Activities.addActivities([activity]),
            user_activities_1.UserActivities.addActivities([fromUserActivity]),
        ]);
    }
}
exports.BidActivity = BidActivity;
//# sourceMappingURL=bid-activity.js.map