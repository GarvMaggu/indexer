import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare enum DataSourceKind {
    askEvents = "ask-events",
    tokenFloorAskEvents = "token-floor-ask-events",
    collectionFloorAskEvents = "collection-floor-ask-events",
    asks = "asks",
    tokens = "tokens",
    collections = "collections",
    sales = "sales",
    attributeKeys = "attribute-keys",
    attributes = "attributes",
    tokenAttributes = "token-attributes"
}
export declare const getLockName: (kind: DataSourceKind) => string;
export declare const addToQueue: (kind: DataSourceKind) => Promise<void>;
//# sourceMappingURL=export-data.d.ts.map