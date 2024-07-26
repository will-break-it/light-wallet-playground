import { util } from "@cardano-sdk/cardano-services";
import {
  BlockEntity,
  CredentialEntity,
  TransactionEntity,
} from "@cardano-sdk/projection-typeorm";
import { of } from "rxjs";
import { WebSocketServer } from "ws";
import { ClientMessage } from "./messages/clientMessage";
import { Subscribe } from "./messages/subscribe";
import { CARDANO_PREPROD, Welcome } from "./messages/welcome";

const wss = new WebSocketServer({ port: 8080 });

class TransactionIndexerByCredentialsService extends util.TypeormService {
  constructor() {
    super("TransactionIndexerByCredentialsService", {
      connectionConfig$: of({
        database: "projection",
        host: "localhost",
        password: "doNoUseThisSecret!",
        port: 5432,
        username: "postgres",
      }),
      logger: { ...console, info: console.log },
      entities: [BlockEntity, CredentialEntity, TransactionEntity],
    });
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
    console.log("Client disconnected");
  });
});

console.log("WebSocket server is running on ws://localhost:8080");
