import { BaseEventParams } from "@/events-sync/parser";
import { OrderKind } from "@/orderbook/orders";
export declare type Event = {
    orderKind: OrderKind;
    maker: string;
    nonce: string;
    baseEventParams: BaseEventParams;
};
export declare const addEvents: (events: Event[], backfill?: boolean) => Promise<void>;
export declare const removeEvents: (block: number, blockHash: string) => Promise<void>;
//# sourceMappingURL=nonce-cancel-events.d.ts.map