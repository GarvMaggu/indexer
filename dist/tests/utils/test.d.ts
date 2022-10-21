import { EnhancedEvent } from "@/events-sync/handlers/utils";
import { TransactionReceipt, Log, Block } from "@ethersproject/abstract-provider";
export declare function getEventParams(log: Log, blockResult: Block): {
    address: string;
    txHash: string;
    txIndex: number;
    block: number;
    blockHash: string;
    logIndex: number;
    timestamp: number;
    batchIndex: number;
};
export declare function getEventsFromTx(tx: TransactionReceipt): Promise<EnhancedEvent[]>;
export declare function wait(ms: number): Promise<unknown>;
//# sourceMappingURL=test.d.ts.map