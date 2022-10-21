import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type FillInfo = {
    context: string;
    orderId?: string;
    orderSide: "buy" | "sell";
    contract: string;
    tokenId: string;
    amount: string;
    price: string;
    timestamp: number;
};
export declare const addToQueue: (fillInfos: FillInfo[]) => Promise<void>;
//# sourceMappingURL=queue.d.ts.map