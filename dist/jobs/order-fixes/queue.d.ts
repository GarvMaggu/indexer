import { Queue } from "bullmq";
export declare const queue: Queue<any, any, string>;
export declare type OrderFixInfo = {
    by: "id";
    data: {
        id: string;
    };
} | {
    by: "token";
    data: {
        token: string;
    };
} | {
    by: "maker";
    data: {
        maker: string;
    };
} | {
    by: "contract";
    data: {
        contract: string;
    };
};
export declare const addToQueue: (orderFixInfos: OrderFixInfo[]) => Promise<void>;
//# sourceMappingURL=queue.d.ts.map