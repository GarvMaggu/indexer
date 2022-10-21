import { Queue } from "bullmq";
import { TriggerKind } from "@/jobs/order-updates/types";
import { OrderKind } from "@/orderbook/orders";
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
        kind: "buy-balance";
        contract: string;
    } | {
        kind: "buy-approval";
        contract: string;
        orderKind?: OrderKind;
        operator?: string;
    } | {
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
//# sourceMappingURL=by-maker-queue.d.ts.map