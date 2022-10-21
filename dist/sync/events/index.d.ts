import { EventDataKind } from "@/events-sync/data";
export declare const syncEvents: (fromBlock: number, toBlock: number, options?: {
    backfill?: boolean | undefined;
    syncDetails: {
        method: "events";
        events: EventDataKind[];
    } | {
        method: "address";
        address: string;
    };
} | undefined) => Promise<void>;
export declare const unsyncEvents: (block: number, blockHash: string) => Promise<void>;
//# sourceMappingURL=index.d.ts.map