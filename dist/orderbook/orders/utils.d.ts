/// <reference types="node" />
import { OrderKind } from "@/orderbook/orders";
export declare type OrderMetadata = {
    schema?: {
        kind: "attribute";
        data: {
            collection: string;
            attributes: [
                {
                    key: string;
                    value: string;
                }
            ];
        };
    };
    schemaHash?: string;
    source?: string;
};
export declare type DbOrder = {
    id: string;
    kind: OrderKind;
    side: "buy" | "sell" | "bundle";
    fillability_status: string;
    approval_status: string;
    token_set_id?: string | null;
    token_set_schema_hash?: Buffer | null;
    offer_bundle_id?: string | null;
    consideration_bundle_id?: string | null;
    bundle_kind?: "bundle-ask" | null;
    maker: Buffer;
    taker: Buffer;
    price: string;
    value: string;
    currency?: Buffer;
    currency_price: string;
    currency_value: string;
    quantity_remaining?: string;
    valid_between: string;
    nonce: string | null;
    source_id_int?: number;
    is_reservoir?: boolean | null;
    contract?: Buffer | null;
    conduit: Buffer | null;
    fee_bps: number;
    fee_breakdown?: object | null;
    dynamic?: boolean | null;
    needs_conversion: boolean | null;
    raw_data: object;
    expiration: string;
};
export declare const generateSchemaHash: (schema?: object | undefined) => string;
//# sourceMappingURL=utils.d.ts.map