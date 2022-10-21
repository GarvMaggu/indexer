import { Queue } from "bullmq";
import * as tokenListSet from "@/orderbook/token-sets/token-list";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (tokenSets: tokenListSet.TokenSet[]) => Promise<void>;
//# sourceMappingURL=token-sets-queue.d.ts.map