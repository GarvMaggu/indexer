import { Queue } from "bullmq";
import { TriggerKind } from "@/jobs/order-updates/types";
export declare const queue: Queue<any, any, string>;
export declare type MakerInfo = {
    context: string;
    maker: string;
    trigger: {
        kind: TriggerKind;
        txHash: string;
        txTimestamp: number;
    };
    data: {
        kind: "sell-balance";
        contract: string;
        tokenId: string;
    } | {
        kind: "sell-approval";
        contract: string;
        operator: string;
    };
};
export declare const addToQueue: (makerInfos: MakerInfo[]) => Promise<void>;
//# sourceMappingURL=by-maker-bundle-queue.d.ts.map