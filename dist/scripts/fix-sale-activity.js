"use strict";
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const main = async () => {
    let id = 233303219;
    const maxActivitiesId = 233557401;
    const maxUserActivitiesId = 333702983;
    const limit = 3000;
    while (id < maxActivitiesId) {
        const results = await fixTable("activities", id, limit);
        const newMaxId = lodash_1.default.maxBy(results, (result) => result.id);
        id = newMaxId ? newMaxId.id : id + limit;
        console.log(`activities - ${id}`);
    }
    id = 330133791;
    while (id < maxUserActivitiesId) {
        const results = await fixTable("user_activities", id, limit);
        const newMaxId = lodash_1.default.maxBy(results, (result) => result.id);
        id = newMaxId ? newMaxId.id : id + limit;
        console.log(`user_activities - ${id}`);
    }
};
async function fixTable(table, id, limit) {
    const query = `
      UPDATE ${table}
      SET from_address = z.taker, to_address = z.maker, metadata = metadata || jsonb_build_object('orderId', order_id)
      FROM (
          SELECT id, "orderId", maker, taker, COALESCE(order_id, '') AS order_id
          FROM (
              SELECT id, (metadata->'logIndex')::INTEGER AS "logIndex", (metadata->>'batchIndex')::INTEGER AS "batchIndex", REPLACE((metadata->>'transactionHash'), '0x', '\\x') AS "transactionHash",
                     (metadata->>'orderId') AS "orderId"
              FROM ${table}
              WHERE type = 'sale'
              AND id > ${id}
              ORDER BY id ASC
              LIMIT ${limit}
          ) x
          JOIN fill_events_2 ON x."logIndex" = fill_events_2.log_index AND x."batchIndex" = fill_events_2.batch_index AND x."transactionHash" = fill_events_2.tx_hash::TEXT
          AND order_side = 'buy'
          AND "orderId" IS NULL
          ORDER BY id ASC
      ) z
      WHERE ${table}.id = z.id
      RETURNING ${table}.id
    `;
    return await db_1.idb.manyOrNone(query);
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=fix-sale-activity.js.map