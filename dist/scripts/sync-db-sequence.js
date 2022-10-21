"use strict";
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const db_1 = require("@/common/db");
const main = async () => {
    let id;
    id = await getNextId("token_floor_sell_events");
    await updateSequence("token_floor_sell_events_id_seq", id);
    id = await getNextId("attribute_keys");
    await updateSequence("attribute_keys_id_seq", id);
    id = await getNextId("attributes");
    await updateSequence("attributes_id_seq", id);
    id = await getNextId("sources_v2");
    await updateSequence("sources_v2_id_seq", id);
    id = await getNextId("collection_floor_sell_events");
    await updateSequence("collection_floor_sell_events_id_seq", id);
    id = await getNextId("order_events");
    await updateSequence("order_events_id_seq", id);
    id = await getNextId("collections_sets");
    await updateSequence("collections_sets_id_seq", id);
    id = await getNextId("activities");
    await updateSequence("activities_id_seq", id);
    id = await getNextId("user_activities");
    await updateSequence("user_activities_id_seq", id);
};
async function getNextId(table) {
    const query = `SELECT nextval(pg_get_serial_sequence('${table}', 'id')) AS "next_id"`;
    const result = await db_1.idb.one(query);
    return result.next_id;
}
async function updateSequence(sequence, newValue) {
    const query = `ALTER SEQUENCE ${sequence} restart with ${newValue};`;
    await db_1.idb.none(query); // This pointed originally to the replica
}
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=sync-db-sequence.js.map