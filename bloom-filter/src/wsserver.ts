import { writeCSV } from "jsr:@vslinko/csv";

import {
  WebSocketClient,
  WebSocketServer,
} from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import channel from "./broker/index.ts";
import { metrics, registerTxConsumer } from "./broker/tx.handler.ts";
import { HEARTBEAT_INTERVAL_MS, WEBSOCKET_PORT } from "./constants.ts";
import { handleSetFilter } from "./message/handlers/set-filter.handler.ts";
import {
  MessageType,
  OptionalFilter,
  SetFilterMessage,
} from "./message/types.ts";
import { createLogfile } from "./utils.ts";

/// :- Websocket Server Setup
const wss = new WebSocketServer(WEBSOCKET_PORT);
const clients = new Map<WebSocketClient, OptionalFilter>();
const heartbeats = new Map<WebSocketClient, number>();

/// :- Websocket Setup
wss.addListener("connection", (client: WebSocketClient) => {
  client.on("message", (event) => {
    try {
      const message = JSON.parse(event);
      if ("type" in message) {
        switch (message.type as MessageType) {
          case "set_filter": {
            handleSetFilter(message as SetFilterMessage, {
              setFilter: (filter) => clients.set(client, filter),
            });
            break;
          }
          default:
            throw Error(`Unknown message type: ${message.type}`);
        }
      } else {
        throw Error(`Unknown message: ${message}`);
      }
    } catch (error) {
      console.error("Message error\n", event, "\n", error);
    }
  });

  client.on("error", (ev: Event) => {
    console.log("Error received:", ev);
  });

  client.on("close", (ev: CloseEvent) => {
    console.log("Close received:", ev);
    if (heartbeats.has(client)) {
      clearInterval(heartbeats.get(client));
    }

    if (clients.delete(client)) {
      console.log("Unsubscribed client.");
    }
  });

  const heartbeatInterval = setInterval(() => {
    client.send("ping");
  }, HEARTBEAT_INTERVAL_MS);
  heartbeats.set(client, heartbeatInterval);
});

wss.addListener("error", (error) => {
  console.error(`WebSocket error: ${error}`);
});

wss.addListener("close", function (code: number, reason: string) {
  console.log(`WebSocket closed with code ${code} and reason ${reason}`);
});

console.log(`Server running on ws://localhost:${WEBSOCKET_PORT}`);

registerTxConsumer(clients);

/// :- Util Functions

Deno.addSignalListener("SIGINT", async () => {
  console.log("Closing websocket server...");

  const logFile = await createLogfile(`clients-${clients.size}`);
  if (logFile && metrics.length > 0) {
    console.log("Writing metrics to file");
    console.debug(metrics);
    await writeCSV(logFile, metrics);
  }
  await channel.close();

  wss.clients.forEach(async (c) => await c.close());
  await wss.close();
  Deno.exit(0);
});
