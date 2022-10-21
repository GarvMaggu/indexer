import * as Sdk from "@reservoir0x/sdk";
import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type PostOrderExternalParams = {
    orderId: string;
    orderData: Sdk.Seaport.Types.OrderComponents;
    orderbook: "opensea";
    orderbookApiKey: string;
    retry: number;
} | {
    orderId: string;
    orderData: Sdk.LooksRare.Types.MakerOrderParams;
    orderbook: "looks-rare";
    orderbookApiKey: string;
    retry: number;
} | {
    orderId: string;
    orderData: Sdk.X2Y2.Types.LocalOrder;
    orderbook: "x2y2";
    orderbookApiKey: string;
    retry: number;
} | {
    orderId: string;
    orderData: Sdk.Universe.Types.Order;
    orderbook: "universe";
    retry: number;
};
export declare const addToQueue: (orderId: string | null, orderData: Record<string, unknown>, orderbook: string, orderbookApiKey: string | null, retry?: number, delay?: number, prioritized?: boolean) => Promise<void>;
//# sourceMappingURL=index.d.ts.map