import { util } from "@cardano-sdk/cardano-services";
import {
  BlockEntity,
  CredentialEntity,
  TransactionEntity,
} from "@cardano-sdk/projection-typeorm";
import { Client as Postgres, Notification } from "pg";
import {
  concat,
  from,
  of,
  retry,
  BehaviorSubject,
  SubscriptionLike,
} from "rxjs";
import { RawData, WebSocket, WebSocketServer } from "ws";
import { ClientMessage } from "./messages/clientMessage";
import { Subscribe } from "./messages/subscribe";
import { CARDANO_PREPROD, Welcome } from "./messages/welcome";
import { Point, PointOrOrigin } from "./types";
import { fromCamel } from "postgres";

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
  tip: PointOrOrigin = "origin";
  #clientsByCredential: Record<string, WebSocket> = {};

  #subscriptions = new Array<SubscriptionLike>();

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

    this.#subscriptions.push(
      concat(from(this.#db.connect()), from(this.#db.query("LISTEN new_block")))
        .pipe(retry(3))
        .subscribe((_) => {
          this.logger.log("Connected to PostgreSQL");
        })
    );
  }

  async startImpl(): Promise<void> {
    await super.startImpl();

    this.#db.on("notification", this.#postgresNotificationHandler);

    wss.on("connection", (ws) => {
      this.#sendWelcome(ws);
      ws.on("message", this.#clientMessageHandler(ws));
      ws.on("error", (err) => {
        this.logger.error(err);
        this.#unregister(ws);
      });
      ws.on("close", () => this.#unregister(ws));
    });
  }

  async shutdownImpl(): Promise<void> {
    try {
      this.#subscriptions.forEach((sub) => sub.unsubscribe());
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

  #sendWelcome(client: WebSocket) {
    this.logger.log("Client connected");
    const welcome: Welcome = { blockchains: [CARDANO_PREPROD] };
    client.send(JSON.stringify({ welcome }));
  }

  #clientMessageHandler = (client: WebSocket) => async (data: RawData) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      if (!message) throw Error("Invalid message");
      switch (message.type) {
        case "subscribe":
          const credentials = (message as Subscribe).credentials;
          this.#register(credentials, client);
          const transactions = await service.queryTxsBy(credentials);
          client.send(
            JSON.stringify({
              transactions,
              point: typeof this.tip === "string" ? this.tip : { ...this.tip },
            })
          );
          break;
        default:
          throw new Error(`Unsupported message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error:`, data.toString("utf-8"));
      console.error(error);
      client.send(JSON.stringify({ error }));
    }
  };

  async #postgresNotificationHandler({ payload }: Notification) {
    if (!payload) return;
    const block: BlockEntity = JSON.parse(payload);

    await this.withDataSource(async (ds) => {
      const transactionRepository = ds.manager.getRepository(TransactionEntity);
      const transactions = await transactionRepository
        .createQueryBuilder("transaction")
        .leftJoinAndSelect("transaction.credentials", "credential")
        .where("transaction.block_id = :blockId", { blockId: block.slot })
        .getMany();

      const publishable = transactions.reduce((map, tx) => {
        for (const credential of tx.credentials ?? []) {
          const client = this.#clientsByCredential[credential.credentialHash!];
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
  }

  #register(credentials: string[], client: WebSocket) {
    for (const credential of credentials) {
      this.#clientsByCredential[credential] = client;
    }
  }

  #unregister(client: WebSocket) {
    this.logger.log("Client disconnected");
    for (const [credential, c] of Object.entries(this.#clientsByCredential)) {
      if (client === c) {
        delete this.#clientsByCredential[credential];
      }
    }
  }

  async queryTxsBy(credentials: string[]): Promise<TransactionEntity[]> {
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

console.log("WebSocket server is running on ws://localhost:8080");
