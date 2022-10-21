import { Log } from "@ethersproject/abstract-provider";
import * as blocksModel from "@/models/blocks";
export declare type BaseEventParams = {
    address: string;
    block: number;
    blockHash: string;
    txHash: string;
    txIndex: number;
    logIndex: number;
    timestamp: number;
    batchIndex: number;
};
export declare const parseEvent: (log: Log, blocksCache: Map<number, blocksModel.Block>, batchIndex?: number) => Promise<BaseEventParams>;
//# sourceMappingURL=parser.d.ts.map