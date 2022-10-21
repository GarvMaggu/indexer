import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type HandleBuyOrderParams = {
    attributeId: number;
    topBuyValue: number | null;
};
export declare const addToQueue: (params: HandleBuyOrderParams) => Promise<void>;
//# sourceMappingURL=handle-new-buy-order.d.ts.map