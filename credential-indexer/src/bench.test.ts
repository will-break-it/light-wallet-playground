import { WebSocket } from "ws";
import { Cardano } from "@cardano-sdk/core";
import { Mappers } from "@cardano-sdk/projection";

const preprod_addresses: ClientAddress[] = require("../../preprod-addresses.json");

type ClientAddress = {
  tx_count: number;
  address: string;
  stake_address: string;
};

type ClientId = number;

interface ClientMetrics {
  /** Defines the total number of transactions received from server */
  txsCount: number;
  /**
   * Defines the time delta between:
   * start: sending subscribe message with credentials to server
   * end: receiving the initial transaction(s) back from server
   */
  replayDelta: number;
  /**
   * Defines the time delta between:
   * start: the server receiving the postgres notification for a new block, fetching block's txs and publishing new point + optionally relevant txs to clients
   * end: client receives message for new tip
   */
  tipDelta: number[];
}

const DEFAULT_CLIENT_COUNT = 3;
const args = process.argv.slice(2);
const clientCountArg = args.find((arg) => arg.startsWith("--arg="));
const clientCount = clientCountArg ? Number.parseInt(clientCountArg.split("=")[1]) : DEFAULT_CLIENT_COUNT;

const addresses: ClientAddress[] = preprod_addresses.slice(0, clientCount);
const metrics = new Map<ClientId, ClientMetrics>();

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

interface WithPoint {
  point: Point;
}
interface WithTransactions {
  transactions: Transaction[];
}

const logMetrics = (id: number) => {
  console.group(`Client ${id}`);
  console.log(`TxCount: ${metrics.get(id)!.txsCount}`);
  console.log(`Replay: ${metrics.get(id)!.replayDelta}`);
  console.group(`Tip`);
  console.log(`Min ${metrics.get(id)!.tipDelta.sort((a,b) => a - b).at(0) ?? -1}`);
  console.log(`Max ${metrics.get(id)!.tipDelta.sort((a,b) => b - a).at(0) ?? -1}`);
  console.log(`Avg ${metrics.get(id)!.tipDelta.reduce((sum, v) => sum += v, 0) / metrics.get(id)!.tipDelta.length}`);
  console.groupEnd();
  console.groupEnd();
}

const sendSubscription =
  (client: WebSocket) => (credentials: string[]) => () => {
    client.send(JSON.stringify({ type: "subscribe", credentials }));
  };

const credentialsFromAddress = ({ address, stake_address }: ClientAddress) => {
  const { paymentCredentialHash, stakeCredential } =
    Mappers.credentialsFromAddress(Cardano.PaymentAddress(address));
  const rewardPaymentCredential = Cardano.RewardAddress.fromAddress(
    Cardano.Address.fromBech32(stake_address)!
  )!.getPaymentCredential();
  return [
    ...new Set(
      [paymentCredentialHash, stakeCredential, rewardPaymentCredential]
        .filter((c) => c !== undefined && typeof c === "string")
        .map((c) => c!.toString())
    ),
  ];
};

// Replay Test
for (let id = 0; id < clientCount; id++) {
  let subscriptionStart: number = 0;
  const client = new WebSocket("ws://localhost:8080");
  const credentials = credentialsFromAddress(addresses[id]);

  client.addEventListener("open", sendSubscription(client)(credentials));
  client.onmessage = (event) => {
    const message = JSON.parse(event.data.toString());
    if (!message || Object.keys(message).length === 0) return;
    if (message["welcome"] !== undefined) return;

    const replayMsg: WithPoint & WithTransactions = message;
    const txsCount =
      (metrics.get(id)?.txsCount ?? 0) + replayMsg.transactions.length;
    const tipDelta = [...(metrics.get(id)?.tipDelta ?? [])];
    if ("time" in replayMsg && typeof replayMsg.time === "number") {
      tipDelta.push(replayMsg.time);
    }
    metrics.set(id, {
      replayDelta: metrics.get(id)?.replayDelta ?? Date.now() - subscriptionStart,
      txsCount,
      tipDelta,
    });

    logMetrics(id);
  };
}

for (const [id, _] of metrics) {
  logMetrics(id);
}

// TODO:

// find postgres sql string length limitation

// Subscribe in parallel
// measure time for initial tx lookup (max 1000-2000 tx_count) in relation to number of clients (1, 10, 100, 500, 1000)

// how many clients can a single server support?
//
