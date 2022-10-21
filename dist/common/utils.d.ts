/// <reference types="node" />
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
export declare const bn: (value: BigNumberish) => BigNumber;
export declare const formatEth: (value: BigNumberish) => number;
export declare const formatUsd: (value: BigNumberish) => number;
export declare const formatPrice: (value: BigNumberish, decimals?: number) => number;
export declare const getNetAmount: (value: BigNumberish, bps: number) => string;
export declare const encrypt: (text: string) => string;
export declare const decrypt: (text: string) => string;
export declare const fromBuffer: (buffer: Buffer) => string;
export declare const toBuffer: (hexValue: string) => Buffer;
export declare const now: () => number;
export declare const concat: <T>(...items: (T[] | undefined)[]) => T[];
export declare const splitContinuation: (c: string, regEx?: RegExp | undefined) => string[];
export declare const buildContinuation: (c: string) => string;
export declare const regex: {
    base64: RegExp;
    domain: RegExp;
    address: RegExp;
    bytes32: RegExp;
    token: RegExp;
    fee: RegExp;
    number: RegExp;
    unixTimestamp: RegExp;
};
//# sourceMappingURL=utils.d.ts.map