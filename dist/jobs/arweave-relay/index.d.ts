import * as Sdk from "@reservoir0x/sdk";
export declare const addPendingOrdersSeaport: (data: {
    order: Sdk.Seaport.Order | Sdk.Seaport.BundleOrder;
    schemaHash?: string;
    source?: string;
}[]) => Promise<void>;
export declare const addPendingOrdersLooksRare: (data: {
    order: Sdk.LooksRare.Order;
    schemaHash?: string;
    source?: string;
}[]) => Promise<void>;
export declare const addPendingOrdersUniverse: (data: {
    order: Sdk.Universe.Order;
    schemaHash?: string;
    source?: string;
}[]) => Promise<void>;
export declare const addPendingOrdersZeroExV4: (data: {
    order: Sdk.ZeroExV4.Order;
    schemaHash?: string;
    source?: string;
}[]) => Promise<void>;
//# sourceMappingURL=index.d.ts.map