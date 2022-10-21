export declare type Block = {
    hash: string;
    number: number;
    timestamp: number;
};
export declare const saveBlock: (block: Block) => Promise<Block>;
export declare const deleteBlock: (number: number, hash: string) => Promise<null>;
export declare const getBlocks: (number: number) => Promise<Block[]>;
//# sourceMappingURL=index.d.ts.map