"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AskCancelActivity = void 0;
const activities_entity_1 = require("@/models/activities/activities-entity");
const activities_1 = require("@/models/activities");
const lodash_1 = __importDefault(require("lodash"));
const utils_1 = require("@/jobs/activities/utils");
const user_activities_1 = require("@/models/user-activities");
const tokens_1 = require("@/models/tokens");
const logger_1 = require("@/common/logger");
class AskCancelActivity {
    static async handleEvent(data) {
        const token = await tokens_1.Tokens.getByContractAndTokenId(data.contract, data.tokenId, true);
        // If no token found
        if (lodash_1.default.isNull(token)) {
            logger_1.logger.warn("ask-cancel-activity", `No token found for ${JSON.stringify(data)}`);
            return;
        }
        const activityHash = (0, utils_1.getActivityHash)(data.transactionHash, data.logIndex.toString(), data.batchIndex.toString());
        const activity = {
            hash: activityHash,
            type: activities_entity_1.ActivityType.ask_cancel,
            contract: data.contract,
            collectionId: token.collectionId,
            tokenId: data.tokenId,
            orderId: data.orderId,
            fromAddress: data.maker,
            toAddress: null,
            price: data.price,
            amount: data.amount,
            blockHash: data.blockHash,
            eventTimestamp: data.timestamp,
            metadata: {
                orderId: data.orderId,
                transactionHash: data.transactionHash,
                logIndex: data.logIndex,
                batchIndex: data.batchIndex,
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
exports.AskCancelActivity = AskCancelActivity;
//# sourceMappingURL=ask-cancel-activity.js.map