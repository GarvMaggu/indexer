import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type FloorAskInfo = {
    kind: string;
    contract: string;
    tokenId: string;
    txHash: string | null;
    txTimestamp: number | null;
};
export declare const addToQueue: (floorAskInfos: FloorAskInfo[]) => Promise<void>;
//# sourceMappingURL=floor-queue.d.ts.map