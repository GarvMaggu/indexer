"use strict";
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const collectionUpdatesMetadata = __importStar(require("@/jobs/collection-updates/metadata-queue"));
const utils_1 = require("@/common/utils");
const main = async () => {
    const limit = 5000;
    let keepIterate = true;
    let lastId = "";
    while (keepIterate) {
        let idFilter = "";
        if (lastId != "") {
            console.log(`lastId = ${lastId}`);
            idFilter = `WHERE id > '${lastId}'`;
        }
        const query = `
      SELECT id, contract
      FROM collections
      ${idFilter}
      ORDER BY id ASC
      LIMIT ${limit}
    `;
        const collections = await db_1.redb.manyOrNone(query);
        const contracts = lodash_1.default.map(collections, (collection) => (0, utils_1.fromBuffer)(collection.contract));
        await collectionUpdatesMetadata.addToQueue(contracts);
        if (lodash_1.default.size(collections) < limit) {
            keepIterate = false;
        }
        else {
            lastId = lodash_1.default.last(collections).id;
        }
    }
};
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=refresh-all-collections.js.map