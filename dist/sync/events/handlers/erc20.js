"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEvents = void 0;
const constants_1 = require("@ethersproject/constants");
const data_1 = require("@/events-sync/data");
const handleEvents = async (events) => {
    const ftTransferEvents = [];
    const makerInfos = [];
    // Handle the events
    for (const { kind, baseEventParams, log } of events) {
        const eventData = (0, data_1.getEventData)([kind])[0];
        switch (kind) {
            case "erc20-transfer": {
                const parsedLog = eventData.abi.parseLog(log);
                const from = parsedLog.args["from"].toLowerCase();
                const to = parsedLog.args["to"].toLowerCase();
                const amount = parsedLog.args["amount"].toString();
                ftTransferEvents.push({
                    from,
                    to,
                    amount,
                    baseEventParams,
                });
                // Make sure to only handle the same data once per transaction
                const contextPrefix = `${baseEventParams.txHash}-${baseEventParams.address}`;
                makerInfos.push({
                    context: `${contextPrefix}-${from}-buy-balance`,
                    maker: from,
                    trigger: {
                        kind: "balance-change",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    data: {
                        kind: "buy-balance",
                        contract: baseEventParams.address,
                    },
                });
                makerInfos.push({
                    context: `${contextPrefix}-${to}-buy-balance`,
                    maker: to,
                    trigger: {
                        kind: "balance-change",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    data: {
                        kind: "buy-balance",
                        contract: baseEventParams.address,
                    },
                });
                break;
            }
            case "erc20-approval": {
                const parsedLog = eventData.abi.parseLog(log);
                const owner = parsedLog.args["owner"].toLowerCase();
                const spender = parsedLog.args["spender"].toLowerCase();
                // Make sure to only handle the same data once per transaction
                const contextPrefix = `${baseEventParams.txHash}-${baseEventParams.address}`;
                makerInfos.push({
                    context: `${contextPrefix}-${owner}-${spender}-buy-approval`,
                    maker: owner,
                    trigger: {
                        kind: "approval-change",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    data: {
                        kind: "buy-approval",
                        contract: baseEventParams.address,
                        operator: spender,
                    },
                });
                break;
            }
            case "weth-deposit": {
                const parsedLog = eventData.abi.parseLog(log);
                const to = parsedLog.args["to"].toLowerCase();
                const amount = parsedLog.args["amount"].toString();
                ftTransferEvents.push({
                    from: constants_1.AddressZero,
                    to,
                    amount,
                    baseEventParams,
                });
                // Make sure to only handle the same data once per transaction
                const contextPrefix = `${baseEventParams.txHash}-${baseEventParams.address}`;
                makerInfos.push({
                    context: `${contextPrefix}-${to}-buy-balance`,
                    maker: to,
                    trigger: {
                        kind: "balance-change",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    data: {
                        kind: "buy-balance",
                        contract: baseEventParams.address,
                    },
                });
                break;
            }
            case "weth-withdrawal": {
                const parsedLog = eventData.abi.parseLog(log);
                const from = parsedLog.args["from"].toLowerCase();
                const amount = parsedLog.args["amount"].toString();
                ftTransferEvents.push({
                    from,
                    to: constants_1.AddressZero,
                    amount,
                    baseEventParams,
                });
                // Make sure to only handle the same data once per transaction
                const contextPrefix = `${baseEventParams.txHash}-${baseEventParams.address}`;
                makerInfos.push({
                    context: `${contextPrefix}-${from}-buy-balance`,
                    maker: from,
                    trigger: {
                        kind: "balance-change",
                        txHash: baseEventParams.txHash,
                        txTimestamp: baseEventParams.timestamp,
                    },
                    data: {
                        kind: "buy-balance",
                        contract: baseEventParams.address,
                    },
                });
                break;
            }
        }
    }
    return {
        ftTransferEvents,
        makerInfos,
    };
};
exports.handleEvents = handleEvents;
//# sourceMappingURL=erc20.js.map