"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addToQueue = exports.getLockName = exports.DataSourceKind = exports.queue = void 0;
const bullmq_1 = require("bullmq");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const index_1 = require("@/config/index");
const db_1 = require("@/common/db");
const crypto_1 = require("crypto");
const os_1 = require("os");
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const ask_events_1 = require("@/jobs/data-export/data-sources/ask-events");
const token_floor_ask_events_1 = require("@/jobs/data-export/data-sources/token-floor-ask-events");
const collection_floor_ask_events_1 = require("@/jobs/data-export/data-sources/collection-floor-ask-events");
const asks_1 = require("@/jobs/data-export/data-sources/asks");
const tokens_1 = require("@/jobs/data-export/data-sources/tokens");
const collections_1 = require("@/jobs/data-export/data-sources/collections");
const sales_1 = require("@/jobs/data-export/data-sources/sales");
const attribute_keys_1 = require("@/jobs/data-export/data-sources/attribute-keys");
const attributes_1 = require("@/jobs/data-export/data-sources/attributes");
const token_attributes_1 = require("@/jobs/data-export/data-sources/token-attributes");
const QUEUE_NAME = "export-data-queue";
const QUERY_LIMIT = 1000;
exports.queue = new bullmq_1.Queue(QUEUE_NAME, {
    connection: redis_1.redis.duplicate(),
    defaultJobOptions: {
        attempts: 10,
        removeOnComplete: true,
        removeOnFail: 100,
        timeout: 120000,
    },
});
new bullmq_1.QueueScheduler(QUEUE_NAME, { connection: redis_1.redis.duplicate() });
// BACKGROUND WORKER ONLY
if (index_1.config.doBackgroundWork) {
    const worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
        const { kind } = job.data;
        if (await (0, redis_1.acquireLock)((0, exports.getLockName)(kind), 60 * 5)) {
            try {
                const { cursor, sequenceNumber } = await getSequenceInfo(kind);
                const { data, nextCursor } = await getDataSource(kind).getSequenceData(cursor, QUERY_LIMIT);
                if (data.length) {
                    const sequenceNumberPadded = ("000000000000000" + sequenceNumber).slice(-15);
                    const targetName = kind.replace(/-/g, "_");
                    let sequence = "";
                    for (const dataRecord of data) {
                        sequence += JSON.stringify(dataRecord) + os_1.EOL;
                    }
                    await uploadSequenceToS3(`${targetName}/reservoir_${sequenceNumberPadded}.json`, sequence);
                    await setNextSequenceInfo(kind, nextCursor);
                }
                // Trigger next sequence only if there are more results
                job.data.addToQueue = data.length >= QUERY_LIMIT;
                logger_1.logger.info(QUEUE_NAME, `Export finished. kind:${kind}, cursor:${JSON.stringify(cursor)}, sequenceNumber:${sequenceNumber}, nextCursor:${JSON.stringify(nextCursor)}`);
            }
            catch (error) {
                logger_1.logger.error(QUEUE_NAME, `Export ${kind} failed: ${error}`);
            }
            await (0, redis_1.releaseLock)((0, exports.getLockName)(kind));
        }
        else {
            logger_1.logger.info(QUEUE_NAME, `Unable to acquire lock: ${kind}`);
        }
    }, { connection: redis_1.redis.duplicate(), concurrency: 15 });
    worker.on("completed", async (job) => {
        if (job.data.addToQueue) {
            await (0, exports.addToQueue)(job.data.kind);
        }
    });
    worker.on("failed", async (job) => {
        logger_1.logger.error(QUEUE_NAME, `Worker failed: ${JSON.stringify(job)}`);
    });
    worker.on("error", (error) => {
        logger_1.logger.error(QUEUE_NAME, `Worker errored: ${error}`);
    });
}
var DataSourceKind;
(function (DataSourceKind) {
    DataSourceKind["askEvents"] = "ask-events";
    DataSourceKind["tokenFloorAskEvents"] = "token-floor-ask-events";
    DataSourceKind["collectionFloorAskEvents"] = "collection-floor-ask-events";
    DataSourceKind["asks"] = "asks";
    DataSourceKind["tokens"] = "tokens";
    DataSourceKind["collections"] = "collections";
    DataSourceKind["sales"] = "sales";
    DataSourceKind["attributeKeys"] = "attribute-keys";
    DataSourceKind["attributes"] = "attributes";
    DataSourceKind["tokenAttributes"] = "token-attributes";
})(DataSourceKind = exports.DataSourceKind || (exports.DataSourceKind = {}));
const getLockName = (kind) => {
    return `${QUEUE_NAME}:${kind}-lock`;
};
exports.getLockName = getLockName;
const addToQueue = async (kind) => {
    await exports.queue.add((0, crypto_1.randomUUID)(), { kind });
};
exports.addToQueue = addToQueue;
const getSequenceInfo = async (kind) => {
    const query = `SELECT cursor,
                        sequence_number AS "sequenceNumber"
                   FROM data_export_tasks
                   WHERE source = $/kind/`;
    return await db_1.idb.one(query, {
        kind,
    });
};
const setNextSequenceInfo = async (kind, cursor) => {
    const query = `
          UPDATE data_export_tasks
          SET cursor = $/cursor/,
              sequence_number = sequence_number + 1,
              updated_at = now()
          WHERE source = $/kind/
        `;
    await db_1.idb.none(query, {
        kind,
        cursor,
    });
};
const getDataSource = (kind) => {
    switch (kind) {
        case DataSourceKind.askEvents:
            return new ask_events_1.AskEventsDataSource();
        case DataSourceKind.tokenFloorAskEvents:
            return new token_floor_ask_events_1.TokenFloorAskEventsDataSource();
        case DataSourceKind.collectionFloorAskEvents:
            return new collection_floor_ask_events_1.CollectionFloorAskEventsDataSource();
        case DataSourceKind.asks:
            return new asks_1.AsksDataSource();
        case DataSourceKind.tokens:
            return new tokens_1.TokensDataSource();
        case DataSourceKind.collections:
            return new collections_1.CollectionsDataSource();
        case DataSourceKind.sales:
            return new sales_1.SalesDataSource();
        case DataSourceKind.attributeKeys:
            return new attribute_keys_1.AttributeKeysDataSource();
        case DataSourceKind.attributes:
            return new attributes_1.AttributesDataSource();
        case DataSourceKind.tokenAttributes:
            return new token_attributes_1.TokenAttributesDataSource();
    }
    throw new Error(`Unsupported data source ${kind}`);
};
const uploadSequenceToS3 = async (key, data) => {
    const s3UploadAWSCredentials = await getAwsCredentials();
    await new aws_sdk_1.default.S3(s3UploadAWSCredentials)
        .putObject({
        Bucket: index_1.config.dataExportS3BucketName,
        Key: key,
        Body: data,
        ContentType: "application/json",
        ACL: "bucket-owner-full-control",
    })
        .promise();
    if (index_1.config.dataExportS3ArchiveBucketName) {
        try {
            await new aws_sdk_1.default.S3({
                accessKeyId: index_1.config.awsAccessKeyId,
                secretAccessKey: index_1.config.awsSecretAccessKey,
            })
                .putObject({
                Bucket: index_1.config.dataExportS3ArchiveBucketName,
                Key: key,
                Body: data,
                ContentType: "application/json",
            })
                .promise();
        }
        catch (error) {
            logger_1.logger.error(QUEUE_NAME, `Upload ${key} to archive failed: ${error}`);
        }
    }
};
const getAwsCredentials = async () => {
    var _a, _b, _c, _d, _e, _f;
    let sts = new aws_sdk_1.default.STS({
        accessKeyId: index_1.config.awsAccessKeyId,
        secretAccessKey: index_1.config.awsSecretAccessKey,
    });
    const accessRole = await sts
        .assumeRole({
        RoleArn: index_1.config.dataExportAwsAccessRole,
        RoleSessionName: "AssumeRoleSession",
    })
        .promise();
    sts = new aws_sdk_1.default.STS({
        accessKeyId: (_a = accessRole === null || accessRole === void 0 ? void 0 : accessRole.Credentials) === null || _a === void 0 ? void 0 : _a.AccessKeyId,
        secretAccessKey: (_b = accessRole === null || accessRole === void 0 ? void 0 : accessRole.Credentials) === null || _b === void 0 ? void 0 : _b.SecretAccessKey,
        sessionToken: (_c = accessRole === null || accessRole === void 0 ? void 0 : accessRole.Credentials) === null || _c === void 0 ? void 0 : _c.SessionToken,
    });
    const uploadRole = await sts
        .assumeRole({
        RoleArn: index_1.config.dataExportAwsS3UploadRole,
        RoleSessionName: "UploadRoleSession",
        ExternalId: index_1.config.dataExportAwsS3UploadExternalId,
    })
        .promise();
    return {
        accessKeyId: (_d = uploadRole === null || uploadRole === void 0 ? void 0 : uploadRole.Credentials) === null || _d === void 0 ? void 0 : _d.AccessKeyId,
        secretAccessKey: (_e = uploadRole === null || uploadRole === void 0 ? void 0 : uploadRole.Credentials) === null || _e === void 0 ? void 0 : _e.SecretAccessKey,
        sessionToken: (_f = uploadRole === null || uploadRole === void 0 ? void 0 : uploadRole.Credentials) === null || _f === void 0 ? void 0 : _f.SessionToken,
    };
};
//# sourceMappingURL=export-data.js.map