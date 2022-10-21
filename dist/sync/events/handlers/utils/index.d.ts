import { Log } from "@ethersproject/abstract-provider";
import { EventDataKind } from "@/events-sync/data";
import { BaseEventParams } from "@/events-sync/parser";
import * as es from "@/events-sync/storage";
import * as fillUpdates from "@/jobs/fill-updates/queue";
import * as orderUpdatesById from "@/jobs/order-updates/by-id-queue";
import * as orderUpdatesByMaker from "@/jobs/order-updates/by-maker-queue";
import * as orderbookOrders from "@/jobs/orderbook/orders-queue";
import * as tokenUpdatesMint from "@/jobs/token-updates/mint-queue";
export declare type EnhancedEvent = {
    kind: EventDataKind;
    baseEventParams: BaseEventParams;
    log: Log;
};
export declare type OnChainData = {
    fillEvents?: es.fills.Event[];
    fillEventsPartial?: es.fills.Event[];
    fillEventsOnChain?: es.fills.Event[];
    cancelEvents?: es.cancels.Event[];
    cancelEventsOnChain?: es.cancels.Event[];
    bulkCancelEvents?: es.bulkCancels.Event[];
    nonceCancelEvents?: es.nonceCancels.Event[];
    nftApprovalEvents?: es.nftApprovals.Event[];
    ftTransferEvents?: es.ftTransfers.Event[];
    nftTransferEvents?: es.nftTransfers.Event[];
    fillInfos?: fillUpdates.FillInfo[];
    mintInfos?: tokenUpdatesMint.MintInfo[];
    orderInfos?: orderUpdatesById.OrderInfo[];
    makerInfos?: orderUpdatesByMaker.MakerInfo[];
    orders?: orderbookOrders.GenericOrderInfo[];
};
export declare const processOnChainData: (data: OnChainData, backfill?: boolean | undefined) => Promise<void>;
//# sourceMappingURL=index.d.ts.map