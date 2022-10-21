"use strict";
// WARNING! For ease of accounting, make sure to keep the below lists sorted!
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.allJobQueues = void 0;
// Initialize all background job queues and crons
require("@/jobs/arweave-relay");
require("@/jobs/arweave-sync");
require("@/jobs/backfill");
require("@/jobs/bid-updates");
require("@/jobs/cache-check");
require("@/jobs/collections-refresh");
require("@/jobs/collection-updates");
require("@/jobs/currencies");
require("@/jobs/daily-volumes");
require("@/jobs/data-export");
require("@/jobs/events-sync");
require("@/jobs/fill-updates");
require("@/jobs/metadata-index");
require("@/jobs/nft-balance-updates");
require("@/jobs/oracle");
require("@/jobs/order-fixes");
require("@/jobs/order-updates");
require("@/jobs/orderbook");
require("@/jobs/sources");
require("@/jobs/token-updates");
require("@/jobs/update-attribute");
// Export all job queues for monitoring through the BullMQ UI
const fixActivitiesMissingCollection = __importStar(require("@/jobs/activities/fix-activities-missing-collection"));
const processActivityEvent = __importStar(require("@/jobs/activities/process-activity-event"));
const removeUnsyncedEventsActivities = __importStar(require("@/jobs/activities/remove-unsynced-events-activities"));
const arweaveSyncBackfill = __importStar(require("@/jobs/arweave-sync/backfill-queue"));
const arweaveSyncRealtime = __importStar(require("@/jobs/arweave-sync/realtime-queue"));
const topBidUpdate = __importStar(require("@/jobs/bid-updates/top-bid-update-queue"));
const collectionsRefresh = __importStar(require("@/jobs/collections-refresh/collections-refresh"));
const collectionsRefreshCache = __importStar(require("@/jobs/collections-refresh/collections-refresh-cache"));
const collectionUpdatesFloorAsk = __importStar(require("@/jobs/collection-updates/floor-queue"));
const collectionUpdatesMetadata = __importStar(require("@/jobs/collection-updates/metadata-queue"));
const rarity = __importStar(require("@/jobs/collection-updates/rarity-queue"));
const collectionUpdatesTopBid = __importStar(require("@/jobs/collection-updates/top-bid-queue"));
const collectionRecalcFloorAsk = __importStar(require("@/jobs/collection-updates/recalc-floor-queue"));
const currencies = __importStar(require("@/jobs/currencies/index"));
const dailyVolumes = __importStar(require("@/jobs/daily-volumes/daily-volumes"));
const exportData = __importStar(require("@/jobs/data-export/export-data"));
const eventsSyncBackfill = __importStar(require("@/jobs/events-sync/backfill-queue"));
const eventsSyncBlockCheck = __importStar(require("@/jobs/events-sync/block-check-queue"));
const eventsSyncBackfillProcess = __importStar(require("@/jobs/events-sync/process/backfill"));
const eventsSyncRealtimeProcess = __importStar(require("@/jobs/events-sync/process/realtime"));
const eventsSyncRealtime = __importStar(require("@/jobs/events-sync/realtime-queue"));
const eventsSyncFtTransfersWriteBuffer = __importStar(require("@/jobs/events-sync/write-buffers/ft-transfers"));
const eventsSyncNftTransfersWriteBuffer = __importStar(require("@/jobs/events-sync/write-buffers/nft-transfers"));
const fillUpdates = __importStar(require("@/jobs/fill-updates/queue"));
const flagStatusProcessJob = __importStar(require("@/jobs/flag-status/process-queue"));
const flagStatusSyncJob = __importStar(require("@/jobs/flag-status/sync-queue"));
const flagStatusGenerateAttributeTokenSet = __importStar(require("@/jobs/flag-status/generate-attribute-token-set"));
const flagStatusGenerateCollectionTokenSet = __importStar(require("@/jobs/flag-status/generate-collection-token-set"));
const metadataIndexFetch = __importStar(require("@/jobs/metadata-index/fetch-queue"));
const metadataIndexProcess = __importStar(require("@/jobs/metadata-index/process-queue"));
const metadataIndexWrite = __importStar(require("@/jobs/metadata-index/write-queue"));
const updateNftBalanceFloorAskPrice = __importStar(require("@/jobs/nft-balance-updates/update-floor-ask-price-queue"));
const updateNftBalanceTopBid = __importStar(require("@/jobs/nft-balance-updates/update-top-bid-queue"));
const orderFixes = __importStar(require("@/jobs/order-fixes/queue"));
const orderUpdatesById = __importStar(require("@/jobs/order-updates/by-id-queue"));
const orderUpdatesByMaker = __importStar(require("@/jobs/order-updates/by-maker-queue"));
const bundleOrderUpdatesByMaker = __importStar(require("@/jobs/order-updates/by-maker-bundle-queue"));
const orderbookOrders = __importStar(require("@/jobs/orderbook/orders-queue"));
const orderbookPostOrderExternal = __importStar(require("@/jobs/orderbook/post-order-external"));
const orderbookTokenSets = __importStar(require("@/jobs/orderbook/token-sets-queue"));
const fetchSourceInfo = __importStar(require("@/jobs/sources/fetch-source-info"));
const tokenUpdatesMint = __importStar(require("@/jobs/token-updates/mint-queue"));
const tokenRefreshCache = __importStar(require("@/jobs/token-updates/token-refresh-cache"));
const fetchCollectionMetadata = __importStar(require("@/jobs/token-updates/fetch-collection-metadata"));
const handleNewSellOrder = __importStar(require("@/jobs/update-attribute/handle-new-sell-order"));
const handleNewBuyOrder = __importStar(require("@/jobs/update-attribute/handle-new-buy-order"));
const resyncAttributeCache = __importStar(require("@/jobs/update-attribute/resync-attribute-cache"));
const resyncAttributeCollection = __importStar(require("@/jobs/update-attribute/resync-attribute-collection"));
const resyncAttributeFloorSell = __importStar(require("@/jobs/update-attribute/resync-attribute-floor-sell"));
const resyncAttributeKeyCounts = __importStar(require("@/jobs/update-attribute/resync-attribute-key-counts"));
const resyncAttributeValueCounts = __importStar(require("@/jobs/update-attribute/resync-attribute-value-counts"));
exports.allJobQueues = [
    fixActivitiesMissingCollection.queue,
    processActivityEvent.queue,
    removeUnsyncedEventsActivities.queue,
    arweaveSyncBackfill.queue,
    arweaveSyncRealtime.queue,
    currencies.queue,
    topBidUpdate.queue,
    collectionsRefresh.queue,
    collectionsRefreshCache.queue,
    collectionUpdatesFloorAsk.queue,
    collectionUpdatesMetadata.queue,
    rarity.queue,
    collectionUpdatesTopBid.queue,
    collectionRecalcFloorAsk.queue,
    dailyVolumes.queue,
    exportData.queue,
    eventsSyncBackfill.queue,
    eventsSyncBlockCheck.queue,
    eventsSyncBackfillProcess.queue,
    eventsSyncRealtimeProcess.queue,
    eventsSyncRealtime.queue,
    eventsSyncFtTransfersWriteBuffer.queue,
    eventsSyncNftTransfersWriteBuffer.queue,
    fillUpdates.queue,
    flagStatusProcessJob.queue,
    flagStatusSyncJob.queue,
    flagStatusGenerateAttributeTokenSet.queue,
    flagStatusGenerateCollectionTokenSet.queue,
    metadataIndexFetch.queue,
    metadataIndexProcess.queue,
    metadataIndexWrite.queue,
    updateNftBalanceFloorAskPrice.queue,
    updateNftBalanceTopBid.queue,
    orderFixes.queue,
    orderUpdatesById.queue,
    orderUpdatesByMaker.queue,
    bundleOrderUpdatesByMaker.queue,
    orderbookOrders.queue,
    orderbookPostOrderExternal.queue,
    orderbookTokenSets.queue,
    fetchSourceInfo.queue,
    tokenUpdatesMint.queue,
    tokenRefreshCache.queue,
    fetchCollectionMetadata.queue,
    handleNewSellOrder.queue,
    handleNewBuyOrder.queue,
    resyncAttributeCache.queue,
    resyncAttributeCollection.queue,
    resyncAttributeFloorSell.queue,
    resyncAttributeKeyCounts.queue,
    resyncAttributeValueCounts.queue,
];
//# sourceMappingURL=index.js.map