import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type TokenMetadataInfo = {
    collection: string;
    contract: string;
    tokenId: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    mediaUrl?: string;
    flagged?: boolean;
    attributes: {
        key: string;
        value: string;
        kind: "string" | "number" | "date" | "range";
        rank?: number;
    }[];
};
export declare const addToQueue: (tokenMetadataInfos: TokenMetadataInfo[]) => Promise<void>;
//# sourceMappingURL=write-queue.d.ts.map