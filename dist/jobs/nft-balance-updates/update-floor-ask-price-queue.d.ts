import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type UpdateFloorAskPriceInfo = {
    contract: string;
    tokenId: string;
    owner: string;
};
export declare const addToQueue: (infos: UpdateFloorAskPriceInfo[]) => Promise<void>;
//# sourceMappingURL=update-floor-ask-price-queue.d.ts.map