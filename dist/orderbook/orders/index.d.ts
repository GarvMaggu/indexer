export * as cryptopunks from "@/orderbook/orders/cryptopunks";
export * as foundation from "@/orderbook/orders/foundation";
export * as looksRare from "@/orderbook/orders/looks-rare";
export * as seaport from "@/orderbook/orders/seaport";
export * as sudoswap from "@/orderbook/orders/sudoswap";
export * as x2y2 from "@/orderbook/orders/x2y2";
export * as zeroExV4 from "@/orderbook/orders/zeroex-v4";
export * as zora from "@/orderbook/orders/zora";
export * as universe from "@/orderbook/orders/universe";
import * as SdkTypes from "@reservoir0x/sdk/dist/router/types";
import * as NewSdkTypes from "@reservoir0x/sdk-new/dist/router/types";
import { SourcesEntity } from "@/models/sources/sources-entity";
export declare type OrderKind = "wyvern-v2" | "wyvern-v2.3" | "looks-rare" | "zeroex-v4-erc721" | "zeroex-v4-erc1155" | "foundation" | "x2y2" | "seaport" | "rarible" | "element-erc721" | "element-erc1155" | "quixotic" | "nouns" | "zora-v3" | "mint" | "cryptopunks" | "sudoswap" | "universe" | "nftx" | "blur";
export declare const getOrderSourceByOrderKind: (orderKind: OrderKind, address?: string | undefined) => Promise<SourcesEntity | undefined>;
export declare const generateListingDetails: (order: {
    kind: OrderKind;
    currency: string;
    rawData: any;
}, token: {
    kind: "erc721" | "erc1155";
    contract: string;
    tokenId: string;
    amount?: number;
}) => SdkTypes.ListingDetails;
export declare const generateBidDetails: (order: {
    kind: OrderKind;
    rawData: any;
}, token: {
    kind: "erc721" | "erc1155";
    contract: string;
    tokenId: string;
    amount?: number;
}) => Promise<SdkTypes.BidDetails>;
export declare const generateListingDetailsNew: (order: {
    kind: OrderKind;
    currency: string;
    rawData: any;
}, token: {
    kind: "erc721" | "erc1155";
    contract: string;
    tokenId: string;
    amount?: number;
}) => NewSdkTypes.ListingDetails;
export declare const generateBidDetailsNew: (order: {
    kind: OrderKind;
    rawData: any;
}, token: {
    kind: "erc721" | "erc1155";
    contract: string;
    tokenId: string;
    amount?: number;
}) => Promise<NewSdkTypes.BidDetails>;
//# sourceMappingURL=index.d.ts.map