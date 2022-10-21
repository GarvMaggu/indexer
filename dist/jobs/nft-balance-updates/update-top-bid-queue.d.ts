import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type UpdateTopBidInfo = {
    contract: string;
    tokenId: string;
};
export declare const addToQueue: (infos: UpdateTopBidInfo[]) => Promise<void>;
//# sourceMappingURL=update-top-bid-queue.d.ts.map