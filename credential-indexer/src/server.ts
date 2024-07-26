import { util } from "@cardano-sdk/cardano-services";
import {
  BlockEntity,
  CredentialEntity,
  TransactionEntity,
} from "@cardano-sdk/projection-typeorm";
import { of } from "rxjs";
import { WebSocket, WebSocketServer } from "ws";
import { ClientMessage } from "./messages/clientMessage";
import { Subscribe } from "./messages/subscribe";
import { CARDANO_PREPROD, Welcome } from "./messages/welcome";
import { Client as Postgres } from "pg";
import { gunzipSync } from "zlib";

const wss = new WebSocketServer({ port: 8080 });
const connectionConfig = {
  database: "projection",
  host: "localhost",
  password: "doNoUseThisSecret!",
  port: 5432,
  username: "postgres",
};

class TransactionIndexerByCredentialsService extends util.TypeormService {
  #db: Postgres;
  #clientsByCredential: Record<string, WebSocket> = {};

  constructor() {
    super("TransactionIndexerByCredentialsService", {
      connectionConfig$: of(connectionConfig),
      logger: { ...console, info: console.log },
      entities: [BlockEntity, CredentialEntity, TransactionEntity],
    });

    this.#db = new Postgres(
      "postgresql://postgres:doNoUseThisSecret!@localhost/projection"
    );
  }

  async initializeImpl(): Promise<void> {
    await super.initializeImpl();
    this.#db.connect((err) => {
      if (err) {
        this.logger.error("Error connecting to PostgreSQL:", err);
      } else {
        this.logger.log("Connected to PostgreSQL");
      }
    });
  }

  async startImpl(): Promise<void> {
    await super.startImpl();
    this.#db.query("LISTEN new_block", (err) => {
      if (err) {
        this.logger.error("Error listening for notifications:", err);
      } else {
        this.logger.log(
          'Listening for notifications on channel "new_transaction"'
        );
      }
    });

    this.#db.on("notification", async (msg) => {
      if (!msg.payload) return;
      const block: BlockEntity = JSON.parse(msg.payload);
      if (!block.slot) {
        console.error(`No block slot`, block);
        return;
      }

      await this.withDataSource(async (ds) => {
        const transactionRepository =
          ds.manager.getRepository(TransactionEntity);
        const transactions = await transactionRepository
          .createQueryBuilder("transaction")
          .leftJoinAndSelect("transaction.credentials", "credential")
          .where("transaction.block_id = :blockId", { blockId: block.slot })
          .getMany();

        const publishable = transactions.reduce((map, tx) => {
          for (const credential of tx.credentials ?? []) {
            const client =
              this.#clientsByCredential[credential.credentialHash!];
            if (client) {
              // found client subscribed with this credential
              // create list of unqiue txs since a client may match multiple
              const txs = [...(map.get(client) ?? []), tx].reduce((txs, tx) => {
                if (
                  txs.filter((t) => t.txId === tx.txId && t.cbor === tx.cbor)
                    .length === 0
                ) {
                  txs.push(tx);
                }
                return txs;
              }, new Array<TransactionEntity>());
              map.set(client, txs);
            }
          }
          return map;
        }, new Map<WebSocket, TransactionEntity[]>());

        publishable.forEach((transactions, client) => {
          client.send(JSON.stringify({ transactions, point: { ...block } }));
        });
      });
    });
  }

  async shutdownImpl(): Promise<void> {
    try {
      await this.#db.query("UNLISTEN *");
      this.logger.log("Stopped listening for notifications");
      await this.#db.end();
    } catch (error) {
      this.logger.error("Error:", error);
    }
  }

  shutdownAfter(): void {
    this.logger.log("Closed client connection");
  }

  register(credentials: string[], client: WebSocket) {
    for (const credential of credentials) {
      this.#clientsByCredential[credential] = client;
    }
  }

  unregister(client: WebSocket) {
    for (const [credential, c] of Object.entries(this.#clientsByCredential)) {
      if (client === c) {
        delete this.#clientsByCredential[credential];
      }
    }
  }

  async queryBy(credentials: string[]): Promise<TransactionEntity[]> {
    return service.withDataSource((ds) =>
      ds.manager
        .getRepository(TransactionEntity)
        .createQueryBuilder("txs")
        .innerJoin(
          "transaction_credentials",
          "tc",
          "txs.tx_id = tc.transaction_id"
        )
        .innerJoin("credentials", "cs", "tc.credential_id = cs.credential_hash")
        .where("cs.credential_hash IN (:...credentials)", { credentials })
        .getMany()
    );
  }
}

const service = new TransactionIndexerByCredentialsService();
service.initialize().then(() => service.start());

const welcome: Welcome = { blockchains: [CARDANO_PREPROD] };
wss.on("connection", (ws) => {
  console.log("Client connected");
  ws.send(JSON.stringify({ welcome }));

  ws.on("message", async (event) => {
    try {
      const message: ClientMessage = JSON.parse(event.toString());
      if (!message) throw Error("Invalid message");
      switch (message.type) {
        case "subscribe":
          const credentials = (message as Subscribe).credentials;
          const transactions = await service.queryBy(credentials);
          ws.send(JSON.stringify({ transactions }));
          service.register(credentials, ws);
          break;
        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error:`, event.toString("utf-8"));
      console.error(error);
      ws.send(JSON.stringify({ error }));
    }
  });

  ws.on("close", () => {
    service.unregister(ws);
    console.log("Client disconnected");
  });
});

console.log("WebSocket server is running on ws://localhost:8080");
