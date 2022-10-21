import { BaseEventParams } from "@/events-sync/parser";
export declare type Event = {
    owner: string;
    operator: string;
    approved: boolean;
    baseEventParams: BaseEventParams;
};
export declare const addEvents: (events: Event[]) => Promise<void>;
export declare const removeEvents: (block: number, blockHash: string) => Promise<void>;
//# sourceMappingURL=nft-approval-events.d.ts.map