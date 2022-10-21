"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureBuyTxSucceeds = exports.genericTaker = void 0;
const providers_1 = require("@ethersproject/providers");
const evm_tx_simulator_1 = require("@georgeroman/evm-tx-simulator");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
exports.genericTaker = "0x0000000000000000000000000000000000000001";
const ensureBuyTxSucceeds = async (token, tx) => {
    var _a, _b;
    // Simulate the buy transaction
    try {
        const provider = new providers_1.JsonRpcProvider(index_1.config.traceNetworkHttpUrl);
        const result = (0, evm_tx_simulator_1.parseCallTrace)(await (0, evm_tx_simulator_1.getCallTrace)({
            from: tx.from,
            to: tx.to,
            data: tx.data,
            value: (_a = tx.value) !== null && _a !== void 0 ? _a : 0,
            gas: 10000000,
            gasPrice: 0,
            balanceOverrides: {
                [exports.genericTaker]: (_b = tx.value) !== null && _b !== void 0 ? _b : 0,
            },
        }, provider));
        if (result[exports.genericTaker].tokenBalanceState[`${token.kind}:${token.contract}:${token.tokenId}`] !==
            (0, utils_1.bn)(token.amount).toString()) {
            return false;
        }
        return true;
    }
    catch (error) {
        if (error.message === "execution-reverted") {
            return false;
        }
        else {
            throw error;
        }
    }
};
exports.ensureBuyTxSucceeds = ensureBuyTxSucceeds;
//# sourceMappingURL=simulation.js.map