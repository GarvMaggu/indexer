import { AttributeKeysEntityParamsUpdateParams } from "@/models/attribute-keys/attribute-keys-entity";
export declare class AttributeKeys {
    static update(collectionId: string, key: string, fields: AttributeKeysEntityParamsUpdateParams): Promise<null>;
    static delete(collectionId: string, key: string): Promise<null>;
    static getKeysCount(collectionId: string): Promise<any>;
}
//# sourceMappingURL=index.d.ts.map