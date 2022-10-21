import * as Sdk from "@reservoir0x/sdk";
export declare const RATE_LIMIT_REQUEST_COUNT = 2;
export declare const RATE_LIMIT_INTERVAL = 1000;
export declare const postOrder: (order: Sdk.Seaport.Order, apiKey: string) => Promise<void>;
export declare const buildCollectionOffer: (offerer: string, quantity: number, collectionSlug: string, apiKey: string) => Promise<any>;
export declare const postCollectionOffer: (order: Sdk.Seaport.Order, collectionSlug: string, apiKey: string) => Promise<void>;
//# sourceMappingURL=index.d.ts.map