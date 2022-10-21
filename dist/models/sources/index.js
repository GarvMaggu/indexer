"use strict";
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
exports.Sources = void 0;
const constants_1 = require("@ethersproject/constants");
const solidity_1 = require("@ethersproject/solidity");
const crypto_1 = require("crypto");
const lodash_1 = __importDefault(require("lodash"));
const db_1 = require("@/common/db");
const logger_1 = require("@/common/logger");
const redis_1 = require("@/common/redis");
const utils_1 = require("@/common/utils");
const index_1 = require("@/config/index");
const fetchSourceInfo = __importStar(require("@/jobs/sources/fetch-source-info"));
const sources_entity_1 = require("@/models/sources/sources-entity");
const channels_1 = require("@/pubsub/channels");
const sources_json_1 = __importDefault(require("./sources.json"));
class Sources {
    constructor() {
        this.sources = {};
        this.sourcesByName = {};
        this.sourcesByAddress = {};
        this.sourcesByDomain = {};
        this.sourcesByDomainHash = {};
    }
    async loadData(forceDbLoad = false) {
        // Try to load from cache
        const sourcesCache = await redis_1.redis.get(Sources.getCacheKey());
        let sources;
        if (lodash_1.default.isNull(sourcesCache) || forceDbLoad) {
            // If no cache is available, then load from the database
            sources = await db_1.redb.manyOrNone(`
          SELECT
            sources_v2.id,
            sources_v2.domain,
            sources_v2.domain_hash AS "domainHash",
            sources_v2.name,
            sources_v2.address,
            sources_v2.metadata,
            sources_v2.optimized
          FROM sources_v2
        `);
            await redis_1.redis.set(Sources.getCacheKey(), JSON.stringify(sources), "EX", 60 * 60 * 24);
        }
        else {
            // Parse the data
            sources = JSON.parse(sourcesCache);
        }
        for (const source of sources) {
            this.sources[source.id] = new sources_entity_1.SourcesEntity(source);
            this.sourcesByName[lodash_1.default.toLower(source.name)] = new sources_entity_1.SourcesEntity(source);
            this.sourcesByAddress[lodash_1.default.toLower(source.address)] = new sources_entity_1.SourcesEntity(source);
            this.sourcesByDomain[lodash_1.default.toLower(source.domain)] = new sources_entity_1.SourcesEntity(source);
            this.sourcesByDomainHash[lodash_1.default.toLower(source.domainHash)] = new sources_entity_1.SourcesEntity(source);
        }
    }
    static getCacheKey() {
        return "sources";
    }
    static async getInstance() {
        if (!Sources.instance) {
            Sources.instance = new Sources();
            await Sources.instance.loadData();
        }
        return Sources.instance;
    }
    static async forceDataReload() {
        if (Sources.instance) {
            await Sources.instance.loadData(true);
        }
    }
    static getDefaultSource() {
        return new sources_entity_1.SourcesEntity({
            id: 0,
            domain: "reservoir.tools",
            domainHash: "0x1d4da48b",
            address: constants_1.AddressZero,
            name: "Reservoir",
            metadata: {
                icon: "https://www.reservoir.market/reservoir.svg",
                tokenUrlMainnet: "https://www.reservoir.market/${contract}/${tokenId}",
                tokenUrlRinkeby: "https://dev.reservoir.market/${contract}/${tokenId}",
            },
            optimized: true,
        });
    }
    static async syncSources() {
        lodash_1.default.forEach(sources_json_1.default, (item, id) => {
            Sources.addFromJson(Number(id), item.domain, item.domainHash, item.name, item.address, item.data);
        });
    }
    static async addFromJson(id, domain, domainHash, name, address, metadata) {
        await db_1.idb.none(`
        INSERT INTO sources_v2(
          id,
          domain,
          domain_hash,
          name,
          address,
          metadata
        ) VALUES (
          $/id/,
          $/domain/,
          $/domainHash/,
          $/name/,
          $/address/,
          $/metadata:json/
        )
        ON CONFLICT (id) DO UPDATE SET
          metadata = $/metadata:json/,
          domain = $/domain/
      `, {
            id,
            domain,
            domainHash,
            name,
            address,
            metadata,
        });
    }
    async create(domain, address, metadata = {}) {
        const source = await db_1.idb.oneOrNone(`
        INSERT INTO sources_v2(
          domain,
          domain_hash,
          name,
          address,
          metadata
        ) VALUES (
          $/domain/,
          $/domainHash/,
          $/name/,
          $/address/,
          $/metadata:json/
        )
        ON CONFLICT DO NOTHING
        RETURNING *
      `, {
            domain,
            domainHash: (0, solidity_1.keccak256)(["string"], [domain]).slice(0, 10),
            name: domain,
            address,
            metadata,
        });
        // Reload the cache
        await Sources.instance.loadData(true);
        // Fetch domain info
        await fetchSourceInfo.addToQueue(domain);
        await redis_1.redis.publish(channels_1.channels.sourcesUpdated, `New source ${domain}`);
        logger_1.logger.info("sources", `New source '${domain}' was added`);
        return new sources_entity_1.SourcesEntity(source);
    }
    async update(domain, metadata = {}, optimized) {
        const values = {
            domain,
        };
        const updates = [];
        if (!lodash_1.default.isEmpty(metadata)) {
            let jsonBuildObject = "";
            lodash_1.default.forEach(metadata, (value, key) => {
                if (value) {
                    jsonBuildObject += `'${key}', $/${key}/,`;
                    values[key] = value;
                }
            });
            if (jsonBuildObject.length) {
                jsonBuildObject = lodash_1.default.trimEnd(jsonBuildObject, ",");
                updates.push(`metadata = metadata || jsonb_build_object (${jsonBuildObject})`);
            }
        }
        if (optimized != undefined) {
            values["optimized"] = optimized;
            updates.push(`optimized = $/optimized/`);
        }
        if (!updates.length) {
            return;
        }
        const updatesString = updates.map((c) => `${c}`).join(",");
        await db_1.idb.none(`
        UPDATE sources_v2 SET
          ${updatesString}
        WHERE domain = $/domain/
      `, values);
        // Reload the cache
        await Sources.instance.loadData(true);
        await redis_1.redis.publish(channels_1.channels.sourcesUpdated, `Updated source ${domain}`);
    }
    get(id, contract, tokenId, optimizeCheckoutURL = false) {
        let sourceEntity;
        if (id in this.sources) {
            sourceEntity = lodash_1.default.cloneDeep(this.sources[id]);
        }
        else {
            sourceEntity = lodash_1.default.cloneDeep(Sources.getDefaultSource());
        }
        if (sourceEntity && contract && tokenId) {
            if (!sourceEntity.optimized && optimizeCheckoutURL) {
                const defaultSource = Sources.getDefaultSource();
                sourceEntity.metadata.url = this.getTokenUrl(defaultSource, contract, tokenId);
            }
            else {
                sourceEntity.metadata.url = this.getTokenUrl(sourceEntity, contract, tokenId);
            }
        }
        return sourceEntity;
    }
    getByDomain(domain, returnDefault = true) {
        let sourceEntity;
        if (lodash_1.default.toLower(domain) in this.sourcesByDomain) {
            sourceEntity = this.sourcesByDomain[lodash_1.default.toLower(domain)];
        }
        else if (returnDefault) {
            sourceEntity = Sources.getDefaultSource();
        }
        return sourceEntity;
    }
    getByDomainHash(domainHash) {
        if (this.sourcesByDomainHash[domainHash]) {
            return this.sourcesByDomainHash[domainHash];
        }
    }
    getByName(name, returnDefault = true) {
        let sourceEntity;
        if (lodash_1.default.toLower(name) in this.sourcesByName) {
            sourceEntity = this.sourcesByName[lodash_1.default.toLower(name)];
        }
        else if (returnDefault) {
            sourceEntity = Sources.getDefaultSource();
        }
        return sourceEntity;
    }
    getByAddress(address, options) {
        let sourceEntity;
        address = lodash_1.default.toLower(address);
        if (address in this.sourcesByAddress) {
            sourceEntity = this.sourcesByAddress[address];
        }
        else if (options === null || options === void 0 ? void 0 : options.returnDefault) {
            sourceEntity = Sources.getDefaultSource();
        }
        if (sourceEntity && (options === null || options === void 0 ? void 0 : options.contract) && (options === null || options === void 0 ? void 0 : options.tokenId)) {
            sourceEntity.metadata.url = this.getTokenUrl(sourceEntity, options.contract, options.tokenId);
        }
        return sourceEntity;
    }
    async getOrInsert(source) {
        let sourceEntity;
        if (source.match(utils_1.regex.address)) {
            // Case 1: source is an address (deprecated)
            sourceEntity = this.getByAddress(source);
            if (!sourceEntity) {
                sourceEntity = await this.create(source, source);
            }
        }
        else {
            // Case 2: source is a name (deprecated)
            sourceEntity = this.getByName(source, false);
            // Case 3: source is a domain
            if (!sourceEntity) {
                sourceEntity = this.getByDomain(source, false);
            }
            // Create the source if nothing is available
            if (!sourceEntity) {
                const address = "0x" + (0, crypto_1.randomBytes)(20).toString("hex");
                sourceEntity = await this.create(source, address);
            }
        }
        return sourceEntity;
    }
    // TODO: Are we using this anymore? What about support for other chains?
    getTokenUrl(sourceEntity, contract, tokenId) {
        if (index_1.config.chainId == 1) {
            if (sourceEntity.metadata.tokenUrlMainnet && contract && tokenId) {
                sourceEntity.metadata.url = lodash_1.default.replace(sourceEntity.metadata.tokenUrlMainnet, "${contract}", contract);
                return lodash_1.default.replace(sourceEntity.metadata.url, "${tokenId}", tokenId);
            }
        }
        else {
            if (sourceEntity.metadata.tokenUrlRinkeby && contract && tokenId) {
                sourceEntity.metadata.url = lodash_1.default.replace(sourceEntity.metadata.tokenUrlRinkeby, "${contract}", contract);
                return lodash_1.default.replace(sourceEntity.metadata.url, "${tokenId}", tokenId);
            }
        }
    }
}
exports.Sources = Sources;
//# sourceMappingURL=index.js.map