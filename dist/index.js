"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const module_alias_1 = __importDefault(require("module-alias"));
module_alias_1.default.addAliases({
    "@/api": `${__dirname}/api`,
    "@/arweave-sync": `${__dirname}/sync/arweave`,
    "@/common": `${__dirname}/common`,
    "@/config": `${__dirname}/config`,
    "@/models": `${__dirname}/models`,
    "@/utils": `${__dirname}/utils`,
    "@/jobs": `${__dirname}/jobs`,
    "@/orderbook": `${__dirname}/orderbook`,
    "@/events-sync": `${__dirname}/sync/events`,
    "@/pubsub": `${__dirname}/pubsub`,
});
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
//# sourceMappingURL=index.js.map