import { BaseEventParams } from "@/events-sync/parser";
export declare type Event = {
    from: string;
    to: string;
    amount: string;
    baseEventParams: BaseEventParams;
};
export declare const addEvents: (events: Event[], backfill: boolean) => Promise<void>;
export declare const removeEvents: (block: number, blockHash: string) => Promise<void>;
//# sourceMappingURL=ft-transfer-events.d.ts.map