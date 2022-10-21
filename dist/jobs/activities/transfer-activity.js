"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferActivity = void 0;
const activities_entity_1 = require("@/models/activities/activities-entity");
const tokens_1 = require("@/models/tokens");
const lodash_1 = __importDefault(require("lodash"));
const logger_1 = require("@/common/logger");
const activities_1 = require("@/models/activities");
const constants_1 = require("@ethersproject/constants");
const utils_1 = require("@/jobs/activities/utils");
const user_activities_1 = require("@/models/user-activities");
const fixActivitiesMissingCollection = __importStar(require("@/jobs/activities/fix-activities-missing-collection"));
class TransferActivity {
    static async handleEvent(data) {
        const token = await tokens_1.Tokens.getByContractAndTokenId(data.contract, data.tokenId, true);
        // If no token found
        if (lodash_1.default.isNull(token)) {
            logger_1.logger.warn("transfer-activity", `No token found for ${JSON.stringify(data)}`);
            return;
        }
        const activityHash = (0, utils_1.getActivityHash)(data.transactionHash, data.logIndex.toString(), data.batchIndex.toString());
        const activity = {
            type: data.fromAddress == constants_1.AddressZero ? activities_entity_1.ActivityType.mint : activities_entity_1.ActivityType.transfer,
            hash: activityHash,
            contract: data.contract,
            collectionId: token.collectionId,
            tokenId: data.tokenId,
            fromAddress: data.fromAddress,
            toAddress: data.toAddress,
            price: 0,
            amount: data.amount,
            blockHash: data.blockHash,
            eventTimestamp: data.timestamp,
            metadata: {
                transactionHash: data.transactionHash,
                logIndex: data.logIndex,
                batchIndex: data.batchIndex,
            },
        };
        const userActivities = [];
        // One record for the user to address
        const toUserActivity = lodash_1.default.clone(activity);
        toUserActivity.address = data.toAddress;
        userActivities.push(toUserActivity);
        if (data.fromAddress != constants_1.AddressZero) {
            // One record for the user from address if not a mint event
            const fromUserActivity = lodash_1.default.clone(activity);
            fromUserActivity.address = data.fromAddress;
            userActivities.push(fromUserActivity);
        }
        await Promise.all([
            activities_1.Activities.addActivities([activity]),
            user_activities_1.UserActivities.addActivities(userActivities),
        ]);
        // If collection information is not available yet when a mint event
        if (!token.collectionId && data.fromAddress == constants_1.AddressZero) {
            await fixActivitiesMissingCollection.addToQueue(data.contract, data.tokenId);
        }
    }
}
exports.TransferActivity = TransferActivity;
//# sourceMappingURL=transfer-activity.js.map