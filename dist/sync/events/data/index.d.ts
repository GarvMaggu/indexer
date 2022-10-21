import { Interface } from "@ethersproject/abi";
export declare type EventDataKind = "erc721-transfer" | "erc1155-transfer-single" | "erc1155-transfer-batch" | "erc721/1155-approval-for-all" | "erc20-approval" | "erc20-transfer" | "weth-deposit" | "weth-withdrawal" | "wyvern-v2-orders-matched" | "wyvern-v2.3-orders-matched" | "looks-rare-cancel-all-orders" | "looks-rare-cancel-multiple-orders" | "looks-rare-taker-ask" | "looks-rare-taker-bid" | "zeroex-v4-erc721-order-cancelled" | "zeroex-v4-erc1155-order-cancelled" | "zeroex-v4-erc721-order-filled" | "zeroex-v4-erc1155-order-filled" | "foundation-buy-price-set" | "foundation-buy-price-invalidated" | "foundation-buy-price-cancelled" | "foundation-buy-price-accepted" | "x2y2-order-cancelled" | "x2y2-order-inventory" | "seaport-order-cancelled" | "seaport-order-filled" | "seaport-counter-incremented" | "rarible-match" | "element-erc721-sell-order-filled" | "element-erc721-buy-order-filled" | "element-erc1155-sell-order-filled" | "element-erc1155-buy-order-filled" | "quixotic-order-filled" | "zora-ask-filled" | "zora-ask-created" | "zora-ask-price-updated" | "zora-ask-cancelled" | "zora-auction-ended" | "nouns-auction-settled" | "cryptopunks-punk-offered" | "cryptopunks-punk-no-longer-for-sale" | "cryptopunks-punk-bought" | "cryptopunks-punk-transfer" | "cryptopunks-assign" | "cryptopunks-transfer" | "sudoswap-buy" | "sudoswap-sell" | "sudoswap-token-deposit" | "sudoswap-token-withdrawal" | "universe-match" | "universe-cancel" | "nftx-redeemed" | "nftx-minted" | "blur-orders-matched";
export declare type EventData = {
    kind: EventDataKind;
    addresses?: {
        [address: string]: boolean;
    };
    topic: string;
    numTopics: number;
    abi: Interface;
};
export declare const getEventData: (eventDataKinds?: EventDataKind[] | undefined) => EventData[];
//# sourceMappingURL=index.d.ts.map