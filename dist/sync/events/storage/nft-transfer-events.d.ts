import { BaseEventParams } from "@/events-sync/parser";
export declare type Event = {
    kind: "erc721" | "erc1155" | "cryptopunks";
    from: string;
    to: string;
    tokenId: string;
    amount: string;
    baseEventParams: BaseEventParams;
};
export declare const addEvents: (events: Event[], backfill: boolean) => Promise<void>;
export declare const removeEvents: (block: number, blockHash: string) => Promise<void>;
//# sourceMappingURL=nft-transfer-events.d.ts.map