import { BaseEventParams } from "@/events-sync/parser";
import { OrderKind } from "@/orderbook/orders";
export declare type Event = {
    orderKind: OrderKind;
    maker: string;
    minNonce: string;
    baseEventParams: BaseEventParams;
};
export declare const addEvents: (events: Event[], backfill?: boolean) => Promise<void>;
export declare const removeEvents: (block: number, blockHash: string) => Promise<void>;
//# sourceMappingURL=bulk-cancel-events.d.ts.map