import { OgmiosObservableCardanoNode } from "@cardano-sdk/ogmios";
import { InteractionContextProps } from "@cardano-sdk/ogmios/dist/cjs/CardanoNode/OgmiosObservableCardanoNode/createObservableInteractionContext";
import {
  BlockDataEntity,
  BlockEntity,
  createObservableConnection,
  CredentialEntity,
  OutputEntity,
  TransactionEntity,
  TypeormDevOptions,
  TypeormOptions,
  TypeormStabilityWindowBuffer,
} from "@cardano-sdk/projection-typeorm";
import { ConnectionConfig } from "pg";
import { of } from "rxjs";

const logger = {
  ...console,
  debug: () => void 0,
};

const entities = [
  BlockDataEntity,
  BlockEntity,
  CredentialEntity,
  TransactionEntity,
  OutputEntity,
];
const extensions = {
  pgBoss: true,
};

const cardanoNode = new OgmiosObservableCardanoNode(
  {
    connectionConfig$: of({ host: "localhost", port: 1339 } as ConnectionConfig),
  },
  { logger }
);
const buffer = new TypeormStabilityWindowBuffer({ logger });

// // #region TypeORM setup

// const connectionConfig = {
//   database: "projection",
//   host: "localhost",
//   password: "doNoUseThisSecret!",
//   username: "postgres",
// };

// const dataSource$ = defer(() =>
//   from(
//     (async () => {
//       const dataSource = createDataSource({
//         connectionConfig,
//         devOptions: process.argv.includes("--drop")
//           ? {
//               dropSchema: true,
//               synchronize: true,
//             }
//           : undefined,
//         entities,
//         extensions,
//         logger,
//       });
//       await createDatabase({
//         options: {
//           type: "postgres",
//           ...connectionConfig,
//           installExtensions: true,
//         },
//       });
//       await dataSource.initialize();
//       await buffer.initialize(dataSource.createQueryRunner());
//       return dataSource;
//     })()
//   )
// );

// // #endregion

// Bootstrap.fromCardanoNode({
//   buffer,
//   cardanoNode,
//   logger,
// })
//   .pipe(
//     Mappers.withCertificates(),
//     Mappers.withUtxo(),
//     Mappers.withAddresses(),
//     shareRetryBackoff(
//       (evt$) =>
//         evt$.pipe(
//           withTypeormTransaction({ dataSource$, logger }, extensions),
//           storeBlock(),
//           buffer.storeBlockData(),
//           storeAssets(),
//           storeUtxo(),
//           storeStakePools(),
//           storeStakePoolMetadataJob(),
//           typeormTransactionCommit()
//         ),
//       { shouldRetry: isRecoverableTypeormError }
//     ),
//     requestNext(),
//     logProjectionProgress(logger)
//   )
//   .subscribe();
