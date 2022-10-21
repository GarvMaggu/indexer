import { Queue } from "bullmq";
import * as orders from "@/orderbook/orders";
export declare const queue: Queue<any, any, string>;
export declare type GenericOrderInfo = {
    kind: "looks-rare";
    info: orders.looksRare.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
} | {
    kind: "zeroex-v4";
    info: orders.zeroExV4.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
} | {
    kind: "foundation";
    info: orders.foundation.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
} | {
    kind: "x2y2";
    info: orders.x2y2.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
} | {
    kind: "seaport";
    info: orders.seaport.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
} | {
    kind: "cryptopunks";
    info: orders.cryptopunks.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
} | {
    kind: "zora-v3";
    info: orders.zora.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
} | {
    kind: "sudoswap";
    info: orders.sudoswap.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
} | {
    kind: "universe";
    info: orders.universe.OrderInfo;
    relayToArweave?: boolean;
    validateBidValue?: boolean;
};
export declare const addToQueue: (orderInfos: GenericOrderInfo[], prioritized?: boolean) => Promise<void>;
//# sourceMappingURL=orders-queue.d.ts.map