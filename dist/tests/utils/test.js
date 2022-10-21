"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wait = exports.getEventsFromTx = exports.getEventParams = void 0;
const data_1 = require("@/events-sync/data");
const provider_1 = require("@/common/provider");
function getEventParams(log, blockResult) {
    const address = log.address.toLowerCase();
    const block = log.blockNumber;
    const blockHash = log.blockHash.toLowerCase();
    const txHash = log.transactionHash.toLowerCase();
    const txIndex = log.transactionIndex;
    const logIndex = log.logIndex;
    return {
        address,
        txHash,
        txIndex,
        block,
        blockHash,
        logIndex,
        timestamp: blockResult.timestamp,
        batchIndex: 1,
    };
}
exports.getEventParams = getEventParams;
async function getEventsFromTx(tx) {
    const enhancedEvents = [];
    const availableEventData = (0, data_1.getEventData)();
    const blockResult = await provider_1.baseProvider.getBlock(tx.blockNumber);
    for (let index = 0; index < tx.logs.length; index++) {
        const log = tx.logs[index];
        const eventData = availableEventData.find(({ addresses, topic, numTopics }) => log.topics[0] === topic &&
            log.topics.length === numTopics &&
            (addresses ? addresses[log.address.toLowerCase()] : true));
        if (eventData) {
            enhancedEvents.push({
                kind: eventData.kind,
                baseEventParams: getEventParams(log, blockResult),
                log,
            });
        }
    }
    return enhancedEvents;
}
exports.getEventsFromTx = getEventsFromTx;
function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
exports.wait = wait;
//# sourceMappingURL=test.js.map