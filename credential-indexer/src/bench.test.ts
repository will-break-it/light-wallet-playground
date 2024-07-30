import { WebSocket } from "ws";
import { Cardano } from "@cardano-sdk/core";
import { Mappers } from "@cardano-sdk/projection";

const preprod_addresses: ClientAddress[] = require("../../preprod-addresses.json");

type ClientAddress = {
  tx_count: number;
  address: string;
  stake_address: string;
};

let isConnectedCount = 0;
const CLIENT_COUNT = 3;
const clients: WebSocket[] = [];
const addresses: ClientAddress[] = preprod_addresses.slice(0, CLIENT_COUNT);
const txCountByClientId = new Map<number, number>();

interface Point {
  slot: number;
  hash: string;
  height: number;
}

interface Transaction {
  txId: string;
  cbor: string;
  block: Point;
}

for (let i = 0; i < CLIENT_COUNT; i++) {
  const { address, stake_address } = addresses[i];
  const { paymentCredentialHash, stakeCredential } =
    Mappers.credentialsFromAddress(Cardano.PaymentAddress(address));
  const rewardPaymentCredential = Cardano.RewardAddress.fromAddress(
    Cardano.Address.fromBech32(stake_address)!
  )!.getPaymentCredential();
  const credentials: string[] = [...new Set(
    [paymentCredentialHash, stakeCredential, rewardPaymentCredential]
      .filter((c) => c !== undefined && typeof c === "string")
      .map((c) => c!.toString())
  )];
  if (credentials.length > 0) {
    setTimeout(() => {
      const client = createClient(i, "ws://localhost:8080", credentials);
      clients.push(client);
    }, 10 * i);
  }
}

export function createClient(
  id: number,
  url: string,
  credentials: string[]
): WebSocket {
  const client = new WebSocket(url);
  client.addEventListener("open", () => {
    isConnectedCount++;
    client.send(JSON.stringify({ type: "subscribe", credentials }));
  });

  client.onmessage = (event) => {
    const message = JSON.parse(event.data.toString());
    if (!message || Object.keys(message).length === 0) return;
    if (message["welcome"] !== undefined) return;
    console.group(`Client ${id}`);
    console.log(`Address: ${preprod_addresses[id].address}`)
    console.log(`Reward: ${preprod_addresses[id].stake_address}`)

    for (const key of Object.keys(message)) {
      if ("point" in message) {
        const point = message.point as Point;
        console.log(`Point: { Slot: ${point.slot} | Hash: ${point.hash} | Height: ${point.height} }`);
      }

      if ("transactions" in message) {
        const transactions = message.transactions as unknown as Transaction[];
        txCountByClientId.set(id, (txCountByClientId.get(id) ?? 0) + transactions.length);
        console.group(
          `Transactions: (${txCountByClientId.get(id) ?? 0}/${preprod_addresses[id].tx_count})`
        );
        for (const tx of transactions) {
          console.log(tx.txId);
        }
        console.groupEnd();
      }
    }
    console.groupEnd();
  };

  client.addEventListener("error", () => {
    console.error(`[${id}] Received Error`);
    isConnectedCount--;
  });

  client.addEventListener("close", () => {
    console.log(`[${id}] Received Close`);
    isConnectedCount--;
  });

  return client;
}
