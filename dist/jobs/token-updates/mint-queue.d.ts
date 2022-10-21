import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type MintInfo = {
    contract: string;
    tokenId: string;
    mintedTimestamp: number;
};
export declare const addToQueue: (mintInfos: MintInfo[]) => Promise<void>;
//# sourceMappingURL=mint-queue.d.ts.map