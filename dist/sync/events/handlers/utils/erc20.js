"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getERC20Transfer = void 0;
const data_1 = require("@/events-sync/data");
const getERC20Transfer = (logs) => {
    var _a;
    for (const log of logs) {
        const erc20EventData = (0, data_1.getEventData)(["erc20-transfer"])[0];
        const address = log.address.toLowerCase();
        if (log.topics[0] === erc20EventData.topic &&
            log.topics.length === erc20EventData.numTopics &&
            ((_a = erc20EventData.addresses) === null || _a === void 0 ? void 0 : _a[address])) {
            return address;
        }
    }
};
exports.getERC20Transfer = getERC20Transfer;
//# sourceMappingURL=erc20.js.map