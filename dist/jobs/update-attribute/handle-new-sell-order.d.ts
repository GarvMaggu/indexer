import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type HandleSellOrderParams = {
    contract: string;
    tokenId: string;
    price: number | null;
    previousPrice: number | null;
};
export declare const addToQueue: (params: HandleSellOrderParams) => Promise<void>;
//# sourceMappingURL=handle-new-sell-order.d.ts.map