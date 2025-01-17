"use strict";
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const db_1 = require("@/common/db");
const main = async () => {
    const collections = [
        "0xf0701a661363f463c8de5bd6b009c0e9ceaba51a",
        "0xff34bbab3df40d40e0f111d8f2527f574cf467e9",
        "0x3bf96afe2291d76f2934350624080faefeec9a46",
        "0xec527364a002e5fbe56b8596aa7e60df614047fa",
        "0x29d8c82adba12c822c37090fc1cf7f430bbc1a60",
        "0x01dbbb64e6f6185ac9923d47e1f9b20dabadd263",
        "0xa470df361c9b76b7783aef501cfb0a941cc060f4",
        "0x2f04d6f5881a0d49b870bea2d03853df7eb46101",
        "0xe8efaa0060e5382a7a50047d56dadcf0769f1ad8",
        "0xc5d82e66edfbf01b952f5cb36793fd0ddc38a601",
        "0x485d4489ce7d6c33368c010853cc3d1f3125f80a",
        "0x0edf898b526203776ee799ed5f58a3d2651ab39b",
        "0x498725f067e519233f9afcb2ec2ff16db1efcff3",
        "0x28b708ee88e608f3307a7d41b930312fc9c9e632",
        "0x436f4eb356ee5b368e06d9284be6a1dafb693efa",
        "0x5d1e816d60e42e5f8849ec802d5a4c9c48e662aa",
        "0xeaca6dc08aff2694366c4405724973e2ac7e49e9",
        "0x87853a0b58f2c36feaf0f9183953d9319e598c16",
        "0x21f53279d74f019b4452237851ce14f37eddc3b9",
        "0x4a5576f8792f20d878cfc507384ffb4625713f3e",
        "0xa7ff114a6ba8b9646a2c20690a75e460b51eff73",
        "0xa20d75e80d531f3ca773c1d7a11552954c79dcdc",
        "0x61121099d012250f889637a012a8a40433f60096",
        "0xe8a190328f48246eb0fdbd85b71aad0f58fe06bd",
        "0x0c6735263ff6c83b47306331cb9c61fe88ea1f26",
        "0xe5b1e33be8d510a090b680306fc1b331816260c1",
        "0x8a98ecccf62ea92def2d8f9098eaf4a384130fa0",
        "0x22a2e9ea1721944d987e63f530d28daaff28e0cf",
        "0xe00d98151b43fa6f2b0888952a392cfc9cf6fc24",
        "0x6ed883c35d58808e71a12826328e13e86755d2a2",
        "0xe17fa72cf70898d4bed5dbca2f389881f15d0490",
        "0xce76cdd167a350d3d20f72528da18f09773fcd6e",
        "0x913e9b0bf8e9c3ac18b28460772d79321a26bdf8",
        "0x2fbf71fbb0ab564dcb263ffd1dec0f3d7482363f",
        "0xe761ccd2ef51ffdff438abd07b84310dd52bb056",
        "0xb8fc20bd31e9e2cb9da93afc8a1d2f983834500f",
        "0x8b7882a7c6c9ca8aa95a523be4f99224e8e16caa",
        "0x851cafceca50608541e0777d92bfc84d19834a54",
        "0xab80184b3bba02e975b6494d570232fb6c6973f1",
        "0xb05e4a819067559cabff1de297cbe214081387ce",
        "0xb31b7bac13041a90aa9907611f3736485e83a7e0",
        "0xaa0647818717230b74aea9ba711566132f224847",
        "0x0be9bfcf90b9331e7281fe75dc823f1a49e28752",
        "0x869f8a4bad7cfc932f692af09645f263ee538a89",
        "0xca13eaa6135d719e743ffebb5c26de4ce2f9600c",
        "0x0c60c90eaa47441725d99ff0fba3cdee50e2329a",
        "0xc4c26501a5251d89a192fb6564df476e000fe211",
        "0x83e05cb1d9ca7e1a6d8180274b4504b2c5414c60",
        "0x3266a5c5b279dbfc214bfe1be080cb920666c160",
        "0xd0d04f51acb118047cae343ac50032d94eb03fac",
        "0xe314137371f23eb633a9f3ca58c43ae3a37ea65b",
        "0x3d906b1c296a9ea28739f91d52b9b2007c7086c4",
        "0x63f4392f994a5fb1730b8f4d1c42d99581623013",
        "0x1a648ecb0ab64f28d0a24b6e76ba0413de162e3a",
        "0xb4dac5809d75daa5091de62175c6bb36dac624a3",
        "0x37757216998880ca85afc25704dd8db0d273dc56",
        "0xc9a075b508d4c6f51a9bcdf9c5a597291e7e8edb",
        "0xdb4dcd7660379dc33e978bc6dfaf0c9c5b08d670",
        "0x870859e1e72fb8bf0d6a642de1f42f14e04768d0",
        "0x8b64bbf8e0b14aa3d7f5f6ddcb7553706c9c6ef3",
        "0x1234bbb1743f3724b3aa444328e545a9adc755a4",
        "0x617c0c8712313fd39b78d6c71e466d745413ef21",
        "0x7b3b12b20732b0c1227a41631c50282f0814b4c6",
        "0x1a387136fcde3a82b0a6629fc64982de535cd406",
        "0x9c991036d40950a96d39aca5d7d478b3b9555dda",
        "0xd5d0bb6b5e6dd29055271b5ea9d2d746c66ce98d",
        "0x01ab7d30525e4f3010af27a003180463a6c811a6",
        "0xa835438096ffe367ac82f50103987eb5cf4f589f",
        "0x99e3323f64380bba45645f4aba5151f1484f6647",
        "0xd9f844840279b93b0e6d2935e861ffa3c42042a4",
        "0x2d8b3538d2b4a7a120d951683b1d387fae4cdbe4",
        "0x37a03d4af1d7046d1126987b20117a0fdcbf6535",
        "0x714a3c939a3664c06e3bb0e8315cefff84526f17",
        "0x8d32980b282bbe375b5498ce82dc20c679d8e14d",
        "0x1089665ce2e3d8d332eaf400f2291914e44998df",
        "0x047a3b1cacb276fed8545787429cd23736b81d9c",
        "0xc5794f58a111828b0e76f3fcac79057a243acec6",
        "0x82ef8bee91f3071d095f8a8f13a42a734c839270",
        "0x6f73ede804cd7bf860474210f12582b25ec4816a",
        "0x46d14b7ba5330e1bbf03dd6ca0ab228a4348be5b",
        "0x914358b00e74ebb61c364dec607c392126bc01f8",
        "0x75d9d2588447d2c8816a832e7db53611ae9affa9",
        "0x765711a274e6022adcd148032042b84ef63aa2ef",
        "0x6c40df0b19e10d21651b41c1a21bda17bf5d0efe",
        "0xa443ba3521936ae6dbb56f1c931cb0e3eea6fbbd",
        "0x77d5e5c76d3b83ef8faac71069ac56a0e10ffcd5",
        "0x58334751d95de3bd90800e1861f7c69c1c8cfd7c",
        "0x8f8c221b7cfdfeb4b62f0318d43beb35bead9041",
        "0xe0355c16b0e1618ebffaf70cb51ea71f0060e6e2",
        "0xa681168007b084f96f0956780f61fa1cf3e814d9",
        "0xd055cdb80f2d9625a3390920e2275c3f3eb25ad7",
        "0x37ea31191cd45b4ad359c51be70c1af76a02a86d",
        "0x3cd123ebfcba07d02f10d6bf7b36439a71b7244f",
        "0x8bb33d3a45393e13333a21ed461c26c434ee91cf",
        "0x22857a963f302da86d029b880379aa791989695c",
        "0x417295225ec7b54bbf4fe4030008bb9c6cae73dd",
        "0xd9e0765f22827b96dc7e769a757ec13cf069d98a",
        "0x6d0ca13f9547a78636d5086ec5e0041f213edaa9",
        "0x0b16667810163f516c2f44364e3eb22bbec74900",
        "0x02bc748cda9c1e4d0abcc510a579f863b5b10f68",
        "0x23aa7060d0a966edeb298e645da304911e7157c1",
        "0xc89b639ba978f48bff093a62e74c9ce91396e05a",
        "0xcb3585d5b0e300c1f68a17cc34640ec7b58dff43",
        "0xefd2dfa5930ddb3d95fb62c731bb4065ae55a8bc",
        "0x184289b51259331d602ed74a1e3662f30a82f549",
        "0x19d4ddb9d1ba1f45475094e417ad6a7de34f6881",
        "0x0e2712fb1bfb6ba845ce01fcc726eea59aee4074",
        "0x1c95266be78a8bbe560b62bca36c36f7c7c078d5",
        "0xf76f54736d8c74fde6545f2945b376e5d0f03b40",
        "0x62f0d28f87522500ac9ae84970f753f3ee21ea8c",
        "0xe4bc99f93a29fb9abe16f2349ef4e0ee2a4a7a1c",
        "0x86f5f5a07a5570feaf6f57b01e7a58b93a6324e0",
        "0x30a0b05e5d3ecda6517396d0003468ecb19a4444",
        "0xb123828c0b5e88f69f7f0b498155920717a47d31",
        "0xa82e9f361af78e39e9f1052e314b5394d3ff8369",
        "0xcf3806fb823dd39d525ed935ba083610ed6324f6",
        "0xe7464e9a2e01bae1d1d76fa40a95fe3026340ae1",
        "0x1d806f9d279344698e14924c3e31151b08cc2d8d",
        "0xd64734bd9c93755f7f14123d9629505d1f9f6dc6",
        "0xa7390edc2ff0ed9a17ccc2e276e17bd73d8955c0",
        "0xe26069e8e7db0c10c95e9d5ca1f08247c8b8e5cc",
        "0x1761ddd1ba38248a2b65c7ddbe12b864c141f0ea",
        "0x5c90a193055421fca3dd83aef455287531892d70",
        "0x86c9684ee5580b69febce6e0d50e0ab43cfbf7e5",
        "0x42f06937520583f96f765ce6c8c867007eaac7cf",
        "0x0abe2f35c6cffff7dfa220afb31d0e08a107691c",
        "0xbb3430273b753af501c6a4cdfb2f2cea48fff086",
        "0xcaccea32949e6494f7173a9d17a5f96ebded5f1c",
        "0x0c8aad51a2aef7537ac68821cf7fb60b2eddf933",
        "0xeb7be6692964fd5e56447ed21aeff5157cd80c12",
        "0x7ff6adfb91555d3109c431be7e7078b1b6b61c21",
        "0x53af4705e25e0eea416ffb470a3cad970b4fe66b",
        "0x58b539ea4baf1116f719ac386f8fa03cc839901f",
        "0x201a6d72b1bb2489e4a1472cea15a80fcc0d13d0",
        "0x1237d87468dc6f31f5043cc28313de95db89229c",
        "0x54fa8cc08ebcf960f8a489eb5e58ecf06ab61d50",
        "0x9ce1c9adfa53ccded0c443c51bf01c89dd024c11",
        "0x9747f94dccc83e2498803cc453ed22874eb19c7b",
        "0xa8dbc0b925ce7da53dd9e4318784845e38850660",
        "0x24bb48e27c98202909196e809cf071bd97a4ada0",
        "0xe9f7a8e9be6f5c3dc7fd59e2386ff53dae528432",
        "0x08056544987f28d3134fe4ce48a8002ec1bfc277",
        "0x311a0220397457b5b0f8f7569d87b1b5d79da629",
        "0x59ff161418be8ef67d8985c38c140cbacf15bf19",
        "0x895d39baf2ed39012571c1d34aef7f77b5a0cb88",
        "0xed54f70484a1925d312cf514e68af545671c6a86",
        "0xd5b2c770dc0a9677cf672d53f554f6f806e75e07",
        "0x2ffa407f116df00349ed07f93992a04193ee15a1",
        "0xb16a1f57c6e6017b0b604b6e05b5b3ae40bdbff3",
        "0xfe73a11ffdfffe01dcd1c9bb08626ebc60e216c8",
        "0xf06bbe0bed442ef0e240c1f3c86651a746f8830d",
        "0xdf1f9ca3acebd5f830499270b9ae323b93889da8",
        "0xd28bc4a14c3a1ee509119091d11778266d92634f",
        "0xf956b9b324ec32bfec53cf4eef33578371692658",
        "0xd7dbb24dc3865baf5a9a8de9dac11e5d0daf5a05",
        "0x193239c374531f36d56b756ea14453de22449d81",
        "0x8ba266ce7516c10ef70370c79c7d81198019c583",
        "0x70d468194c3b5e5f06b2f7aef4ce60be8e4a153e",
        "0x914f018cea74e8dd616927b971e584cc7f1a074f",
        "0xfd830f101f83df78b37f7a39514fcf132f7d3668",
        "0x4b507c1cf8486fd77d564bd68ce7600ff3639d74",
        "0x0fd1307a373ad8bf4335a77083ad021524c74c22",
        "0x9ab9a36423e7cdf5f32b5663a475327d2bfb4d09",
        "0x5711f23665d7a6f80c457000baf34b66d71d30fd",
        "0x747a04c138929f6f5c2e833b8eaacf7f1ee3d671",
        "0x91276894c77a0ee4507b028efd473ecda6c316f6",
        "0xb52cd3de0901f87275c9a0c72d2feadd1b6ed5f3",
        "0x2a5ef3d72dcad693bf57ec6a5a4909bf8fb37205",
        "0xb19efeb1215d58ca464db03daa509ae4aba3764f",
        "0xfa947daea2b941da51ed42147cb9e8cdcf6445fc",
        "0xb8dfff430eb204eeeae713a9d4642352e3df6887",
        "0x6961d139da937ce5227eafe0aefe77b979b12181",
        "0xffcf0f0ce6c72ae208a2002f286d37b26e4275de",
    ];
    for (const collection of collections) {
        // Update the activities
        const updateActivitiesQuery = `
      UPDATE activities
      SET collection_id = (
        SELECT collection_id
        FROM tokens
        WHERE contract = activities.contract
        AND token_id = activities.token_id
      )
      WHERE collection_id = $/collection/
    `;
        await db_1.idb.none(updateActivitiesQuery, { collection });
        // Update the user activities
        const updateUserActivitiesQuery = `
      UPDATE user_activities
      SET collection_id = (
        SELECT collection_id
        FROM tokens
        WHERE contract = user_activities.contract
        AND token_id = user_activities.token_id
      )
      WHERE collection_id = $/collection/
    `;
        await db_1.idb.none(updateUserActivitiesQuery, { collection });
        // Clean the attributes
        const cleanAttributesQuery = `
      DELETE FROM attributes
      WHERE collection_id = $/collection/
    `;
        await db_1.idb.none(cleanAttributesQuery, { collection });
        // Clean the attribute keys
        const cleanAttributeKeysQuery = `
      DELETE FROM attribute_keys
      WHERE collection_id = $/collection/
    `;
        await db_1.idb.none(cleanAttributeKeysQuery, { collection });
        // Clean the attribute keys
        const cleanTokenSetsQuery = `
      DELETE FROM token_sets
      WHERE collection_id = $/collection/
    `;
        await db_1.idb.none(cleanTokenSetsQuery, { collection });
        // Clean the collection
        const cleanCollectionsQuery = `
      DELETE FROM collections
      WHERE id = $/collection/
    `;
        await db_1.idb.none(cleanCollectionsQuery, { collection });
    }
};
main()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=clean-collections.js.map