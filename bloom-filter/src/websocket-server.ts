import { join } from "https://deno.land/std@0.177.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { writeCSV } from "jsr:@vslinko/csv";
import { Lucid } from "https://deno.land/x/lucid/mod.ts";

import {
  encodeBase64,
  decodeBase64,
} from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { connect } from "https://deno.land/x/amqp@v0.24.0/mod.ts";
import { C, toHex } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { WebSocketServer } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { BloomFilter } from "https://esm.sh/bloom-filters@3.0.1";

export interface TxIn {
  outputIndex: number;
  txHash: string;
}

/// :- Constants
const TX_LOG_INTERVAL = 500;
const WALLET_ADDRESS =
  "addr1qx60p92mpmul46h9mzp6grty5rjkejzv0atdvc6ka64fc7r72xn7hte3evkx34mg0dlulhzc9suyczrfnv9e4m95d22qzl4ssj";
const RABBITMQ_URL = "amqp://rabbitmq:rabbitmq@localhost:5672";
const EXCHANGE_NAME = "events.exchange";
const QUEUE_NAME = "cardano";
const EXPECTED_BASE64_WALLET_ADDRESS = bech32ToBase64(WALLET_ADDRESS);
const EXPECTED_FPR = 0.0001; /// False-Positive Rate
const CSV_HEADER = [
  "time",
  `FPR (${EXPECTED_FPR})`,
  `BTR (FPR ${EXPECTED_FPR})`,
  `# txs (FPR ${EXPECTED_FPR})`,
  `# tx matches (FPR ${EXPECTED_FPR})`,
  `# bytes sent (FPR ${EXPECTED_FPR})`,
  `# bytes received (FPR ${EXPECTED_FPR})`,
];

/// :- RabbitMq Connection Setup
const connection = await connect(RABBITMQ_URL);
const channel = await connection.openChannel();

// : - Lucid
const lucid = await Lucid.new();

await channel.declareExchange({ exchange: EXCHANGE_NAME, type: "direct" });
await channel.declareQueue({ queue: QUEUE_NAME, durable: true });
await channel.bindQueue({
  queue: QUEUE_NAME,
  exchange: EXCHANGE_NAME,
  routingKey: "",
});

/// :- Websocket Server Setup
const wss = new WebSocketServer(8080);
const logfile = await createLogfile();

/// :- Print Client Details
let filterInputs: string[] = [];
console.log(`WALLET: ${WALLET_ADDRESS}`);
console.log(`BASE64: ${EXPECTED_BASE64_WALLET_ADDRESS}`);
// const {
//   paymentCredential: clientPaymentCred,
//   stakeCredential: clientStakingCred,
// } = lucid.utils.getAddressDetails(WALLET_ADDRESS);

// if (clientPaymentCred) {
//   console.log(`PaymentCred: ${clientPaymentCred.hash}`);
//   filterInputs.push(clientPaymentCred.hash);
// }
// if (clientStakingCred) {
//   console.log(`StakingCred: ${clientStakingCred.hash}`);
//   filterInputs.push(clientStakingCred.hash);
// }

filterInputs.push(EXPECTED_BASE64_WALLET_ADDRESS);

/**
 * Client estimates error rate based on how many transactions per day a user executes.
 * ~ 20secs per block
 * (60secs / 20) = 3 blocks / minute
 * 3 * 60 * 24 = 4.320 blocks per day  (1 tx per day ~ 1 / 4.320 ~= 0.00025)
 * 4.320 * 5 = 21.600 blocks per epoch (1 tx per epoch ~ 1 / 21.600 ~= 0.00005)
 */
const bloomFilter = BloomFilter.from(
  [EXPECTED_BASE64_WALLET_ADDRESS],
  EXPECTED_FPR
);

/// :- Metrics Definition
let totalTxCount = 0;
let actualBytesSentToClient = 0;
let totalBytesProcessed = 0;
let matchedOutputs = 0;
let matchedPaymentCreds = 0;
let matchedStakingCreds = 0;
const metrics: string[][] = [CSV_HEADER];
let lastTx: string | null = null;

/// :- Websocket Setup
wss.addListener("connection", (ws) => {
  console.log(`Client connected: ${bloomFilter.seed}`);
  channel.consume({ queue: QUEUE_NAME }, async (args, _, data) => {
    const tx = JSON.parse(new TextDecoder().decode(data));
    totalTxCount += 1;
    totalBytesProcessed += data.byteLength;

    let found = false;
    if (!found && "outputs" in tx) {
      const outputAddresses = tx.outputs.map(
        // deno-lint-ignore no-explicit-any
        (o: { [key: string]: any }) => o.address
      );

      for (const base64Address of outputAddresses) {
        try {
          // const { paymentCredential, stakeCredential } =
          //   lucid.utils.getAddressDetails(
          //     C.Address.from_bytes(decodeBase64(base64Address)).to_bech32(
          //       "addr"
          //     )
          //   );

          // if (paymentCredential && bloomFilter.has(paymentCredential.hash)) {
          //   found = true;
          //   matchedPaymentCreds += 1;
          //   console.log(`Matched payCred: ${paymentCredential.hash}`);
          // }

          // if (stakeCredential && bloomFilter.has(stakeCredential.hash)) {
          //   found = true;
          //   matchedStakingCreds += 1;
          //   console.log(`Matched stakeCred: ${stakeCredential.hash}`);
          // }

          if (bloomFilter.has(base64Address)) {
            found = true;
            matchedOutputs += 1;
            break;
          }
        } catch (error) {
          console.error(error);
        }
      }
    }

    if (found) {
      // console.log(
      //   `> https://cardanoscan.io/transaction/${toHex(
      //     decodeBase64(tx.hash)
      //   )}?tab=utxo`
      // );
      actualBytesSentToClient += data.byteLength;
      ws.send(JSON.stringify(tx));
    }

    if (totalTxCount % TX_LOG_INTERVAL == 0) {
      const fpr = toDecimals(matchedOutputs / totalTxCount, 5);
      const btr = toDecimals(actualBytesSentToClient / totalBytesProcessed, 5);

      metrics.push([
        new Date().toLocaleString(),
        `${fpr}`,
        `${btr}`,
        `${totalTxCount}`,
        `${matchedOutputs}`,
        `${totalBytesProcessed}`,
        `${actualBytesSentToClient}`,
      ]);

      /// FPR = False-Positive Rate
      console.log(`FPR: ${fpr}% (${matchedOutputs} Outs/ ${totalTxCount} Txs)`);
      /// TBT = Total Bytes Transferred
      console.log(
        `TBT: ${btr}% (${toDecimals(
          toMegaBytes(actualBytesSentToClient),
          2
        )} MB/ ${toDecimals(toMegaBytes(totalBytesProcessed), 2)} MB)`
      );
    }
    lastTx = toHex(decodeBase64(tx.hash));
    await channel.ack({ deliveryTag: args.deliveryTag });
  });
});

wss.addListener("error", (error) => {
  console.error(`WebSocket error: ${error}`);
});

wss.addListener("close", function (code: number, reason: string) {
  console.log(`WebSocket closed with code ${code} and reason ${reason}`);
});

console.log("Server running on ws://localhost:8080");

/// :- Util Functions

/** Encodes bech32 address to base64. */
function bech32ToBase64(addr: string): string {
  return encodeBase64(C.Address.from_bech32(addr).to_bytes());
}

function toDecimals(num: number, decimals: number): number {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function toMegaBytes(num: number): number {
  return num / (1024 * 1024);
}

async function createLogfile(): Promise<Deno.FsFile> {
  const dir = join("metrics", WALLET_ADDRESS);
  await ensureDir(dir);
  const filePath = join(dir, `addr-fpr-${EXPECTED_FPR}.csv`);
  const file = await Deno.open(filePath, {
    write: true,
    create: true,
    truncate: true,
  });
  return file;
}

Deno.addSignalListener("SIGINT", async () => {
  console.log("Received SIGINT signal, writing metrics to file...");
  console.log(`Tx: ${lastTx}`);

  await writeCSV(logfile, metrics);
  await channel.close();
  wss.clients.forEach(async (c) => await c.close());
  await wss.close();
  Deno.exit(0);
});