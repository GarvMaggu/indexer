import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare function getIndexingMethod(community: string | null): string;
export declare type MetadataIndexInfo = {
    kind: "full-collection";
    data: {
        method: string;
        collection: string;
        continuation?: string;
    };
} | {
    kind: "single-token";
    data: {
        method: string;
        collection: string;
        contract: string;
        tokenId: string;
    };
};
export declare const addToQueue: (metadataIndexInfos: MetadataIndexInfo[], prioritized?: boolean, delayInSeconds?: number) => Promise<void>;
//# sourceMappingURL=fetch-queue.d.ts.map