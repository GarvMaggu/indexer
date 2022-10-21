"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleActivity = void 0;
const activities_entity_1 = require("@/models/activities/activities-entity");
const tokens_1 = require("@/models/tokens");
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = require("@/common/logger");
const activities_1 = require("@/models/activities");
const utils_1 = require("@/jobs/activities/utils");
const user_activities_1 = require("@/models/user-activities");
const constants_1 = require("@ethersproject/constants");
class SaleActivity {
    static async handleEvent(data) {
        // Paid mints will be recorded as mints
        if (data.fromAddress == constants_1.AddressZero) {
            return;
        }
        const token = await tokens_1.Tokens.getByContractAndTokenId(data.contract, data.tokenId, true);
        // If no token found
        if (lodash_1.default.isNull(token)) {
            logger_1.logger.warn("sale-activity", `No token found for ${JSON.stringify(data)}`);
            return;
        }
        // If no collection found
        if (!token.collectionId) {
            logger_1.logger.warn("sale-activity", `No collection found for ${JSON.stringify(data)}`);
        }
        const activityHash = (0, utils_1.getActivityHash)(data.transactionHash, data.logIndex.toString(), data.batchIndex.toString());
        const activity = {
            type: activities_entity_1.ActivityType.sale,
            hash: activityHash,
            contract: data.contract,
            collectionId: token.collectionId,
            tokenId: data.tokenId,
            orderId: data.orderId,
            fromAddress: data.fromAddress,
            toAddress: data.toAddress,
            price: data.price,
            amount: data.amount,
            blockHash: data.blockHash,
            eventTimestamp: data.timestamp,
            metadata: {
                transactionHash: data.transactionHash,
                logIndex: data.logIndex,
                batchIndex: data.batchIndex,
                orderId: data.orderId,
                orderSourceIdInt: data.orderSourceIdInt,
            },
        };
        // One record for the user to address, One record for the user from address
        const toUserActivity = lodash_1.default.clone(activity);
        const fromUserActivity = lodash_1.default.clone(activity);
        toUserActivity.address = data.toAddress;
        fromUserActivity.address = data.fromAddress;
        await Promise.all([
            activities_1.Activities.addActivities([activity]),
            user_activities_1.UserActivities.addActivities([fromUserActivity, toUserActivity]),
        ]);
    }
}
exports.SaleActivity = SaleActivity;
//# sourceMappingURL=sale-activity.js.map