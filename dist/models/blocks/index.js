"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlocks = exports.deleteBlock = exports.saveBlock = void 0;
const db_1 = require("@/common/db");
const utils_1 = require("@/common/utils");
const saveBlock = async (block) => {
    await db_1.idb.none(`
      INSERT INTO blocks (
        hash,
        number,
        "timestamp"
      ) VALUES (
        $/hash/,
        $/number/,
        $/timestamp/
      )
      ON CONFLICT DO NOTHING
    `, {
        hash: (0, utils_1.toBuffer)(block.hash),
        number: block.number,
        timestamp: block.timestamp,
    });
    return block;
};
exports.saveBlock = saveBlock;
const deleteBlock = async (number, hash) => db_1.idb.none(`
      DELETE FROM blocks
      WHERE blocks.hash = $/hash/
        AND blocks.number = $/number/
    `, {
    hash: (0, utils_1.toBuffer)(hash),
    number,
});
exports.deleteBlock = deleteBlock;
const getBlocks = async (number) => db_1.idb
    .manyOrNone(`
        SELECT
          blocks.hash,
          blocks.timestamp
        FROM blocks
        WHERE blocks.number = $/number/
      `, { number })
    .then((result) => result.map(({ hash, timestamp }) => ({
    hash: (0, utils_1.fromBuffer)(hash),
    number,
    timestamp,
})));
exports.getBlocks = getBlocks;
//# sourceMappingURL=index.js.map