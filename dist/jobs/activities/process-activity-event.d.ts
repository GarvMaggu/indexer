import { Queue } from "bullmq";
import { FillEventData } from "@/jobs/activities/sale-activity";
import { NftTransferEventData } from "@/jobs/activities/transfer-activity";
import { NewSellOrderEventData } from "@/jobs/activities/ask-activity";
import { NewBuyOrderEventData } from "@/jobs/activities/bid-activity";
import { BuyOrderCancelledEventData } from "@/jobs/activities/bid-cancel-activity";
import { SellOrderCancelledEventData } from "@/jobs/activities/ask-cancel-activity";
export declare const queue: Queue<any, any, string>;
export declare enum EventKind {
    fillEvent = "fillEvent",
    nftTransferEvent = "nftTransferEvent",
    newSellOrder = "newSellOrder",
    newBuyOrder = "newBuyOrder",
    sellOrderCancelled = "sellOrderCancelled",
    buyOrderCancelled = "buyOrderCancelled"
}
export declare type EventInfo = {
    kind: EventKind.newSellOrder;
    data: NewSellOrderEventData;
    context?: string;
} | {
    kind: EventKind.newBuyOrder;
    data: NewBuyOrderEventData;
    context?: string;
} | {
    kind: EventKind.nftTransferEvent;
    data: NftTransferEventData;
    context?: string;
} | {
    kind: EventKind.fillEvent;
    data: FillEventData;
    context?: string;
} | {
    kind: EventKind.sellOrderCancelled;
    data: SellOrderCancelledEventData;
    context?: string;
} | {
    kind: EventKind.buyOrderCancelled;
    data: BuyOrderCancelledEventData;
    context?: string;
};
export declare const addToQueue: (events: EventInfo[]) => Promise<void>;
//# sourceMappingURL=process-activity-event.d.ts.map