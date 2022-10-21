import { AttributesEntity, AttributesEntityUpdateParams } from "@/models/attributes/attributes-entity";
export declare class Attributes {
    static incrementOnSaleCount(attributesId: number[], incrementBy: number): Promise<null>;
    static getById(attributeId: number): Promise<AttributesEntity | null>;
    static getAttributes(attributesId: number[]): Promise<AttributesEntity[]>;
    static update(attributeId: number, fields: AttributesEntityUpdateParams): Promise<null>;
    static delete(attributeId: number): Promise<null>;
    static getAttributeByCollectionKeyValue(collectionId: string, key: string, value: string): Promise<AttributesEntity | null>;
}
//# sourceMappingURL=index.d.ts.map