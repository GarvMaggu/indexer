import { Queue } from "bullmq";
import { TriggerKind } from "@/jobs/order-updates/types";
export declare const queue: Queue<any, any, string>;
export declare type OrderInfo = {
    context: string;
    trigger: {
        kind: TriggerKind;
        txHash?: string;
        txTimestamp?: number;
        logIndex?: number;
        batchIndex?: number;
        blockHash?: string;
    };
    id?: string;
    tokenSetId?: string;
    side?: "sell" | "buy";
};
export declare const addToQueue: (orderInfos: OrderInfo[]) => Promise<void>;
//# sourceMappingURL=by-id-queue.d.ts.map