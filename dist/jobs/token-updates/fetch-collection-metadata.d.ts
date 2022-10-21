import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type FetchCollectionMetadataInfo = {
    contract: string;
    tokenId: string;
    mintedTimestamp: number;
    newCollection?: boolean;
};
export declare const addToQueue: (infos: FetchCollectionMetadataInfo[], jobId?: string) => Promise<void>;
//# sourceMappingURL=fetch-collection-metadata.d.ts.map