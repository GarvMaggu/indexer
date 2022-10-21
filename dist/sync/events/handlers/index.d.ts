import { EnhancedEvent } from "@/events-sync/handlers/utils";
export declare type EventsInfo = {
    kind: "erc20" | "erc721" | "erc1155" | "blur" | "cryptopunks" | "element" | "foundation" | "looks-rare" | "nftx" | "nouns" | "quixotic" | "seaport" | "sudoswap" | "wyvern" | "x2y2" | "zeroex-v4" | "zora" | "universe";
    events: EnhancedEvent[];
    backfill?: boolean;
};
export declare const processEvents: (info: EventsInfo) => Promise<void>;
//# sourceMappingURL=index.d.ts.map