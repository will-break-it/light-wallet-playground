import { decodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { C, Lucid } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { WebSocketClient } from "https://deno.land/x/websocket@v0.1.4/mod.ts";
import { writeCSV } from "jsr:@vslinko/csv";
import { CSV_HEADER, TX_LOG_INTERVAL } from "../constants.ts";
import { OptionalFilter } from "../message/types.ts";
import { createLogfile } from "../utils.ts";
import channel, { QUEUE_NAME } from "./index.ts";

// Metrics
export const metrics: string[][] = [CSV_HEADER];

/// Defines the total number of incoming transactions processed.
let processedTxCount = 0;
/// Defines the number of transactions filtered/ forwarded to clients.
let matchedTxsCount = 0;
/// Defines the total number of bytes processed from incoming transactions.
let processedBytesCount = 0;
/// Defines the number of bytes forwarded to clients.
let matchedBytesCount = 0;

const lucid = await Lucid.new();

let startTimes: number[] = [];
let endTimes: number[] = [];

export function registerTxConsumer(
  clients: Map<WebSocketClient, OptionalFilter>
) {
  channel.consume({ queue: QUEUE_NAME }, async (args, _, data) => {
    const tx = JSON.parse(new TextDecoder().decode(data));
    const filterMatchables: string[] = [];

    processedTxCount += 1;
    processedBytesCount += data.byteLength;
    startTimes.push(performance.now());

    // Add all output base64 addresses, payment credential hashes & staking credential hashes to filterables
    tx.outputs.forEach((o: { [key: string]: any }) => {
      filterMatchables.push(o.address);

      try {
        const { paymentCredential, stakeCredential } =
          lucid.utils.getAddressDetails(
            C.Address.from_bytes(decodeBase64(o.address)).to_bech32("addr")
          );

        if (paymentCredential) filterMatchables.push(paymentCredential.hash);
        if (stakeCredential) filterMatchables.push(stakeCredential.hash);
      } catch {
        // ignore byron addresses
      }
    });

    clients.forEach((filter, client) => {
      if (filter) {
        for (const matchable of filterMatchables) {
          if (filter.has(matchable)) {
            matchedTxsCount += 1;
            matchedBytesCount += data.byteLength;
            client.send(JSON.stringify(tx));
            break;
          }
        }
      } else {
        client.send(JSON.stringify(tx));
      }
    });

    endTimes.push(performance.now());

    if (processedTxCount % TX_LOG_INTERVAL == 0) {
      const durations: number[] = [];
      for (let i = 0; i < startTimes.length; i++) {
        durations.push(endTimes[i] - startTimes[i]);
      }
      const totalDuration = durations.reduce(
        (sum, duration) => sum + duration,
        0
      );
      const averageDuration = totalDuration / startTimes.length;

      console.log(
        `Clients: ${clients.size} Txs: ${processedTxCount} Avg: ${averageDuration} ms`
      );

      metrics.push([
        new Date().toLocaleString(),
        `${averageDuration}`,
        `${matchedTxsCount}`,
        `${processedTxCount}`,
        `${matchedBytesCount}`,
        `${processedBytesCount}`,
        `${tx.hash}`,
      ]);
      startTimes = [];
      endTimes = [];
    }

    try {
      await channel.ack({ deliveryTag: args.deliveryTag });
    } catch (error) {
      console.error(error);
    }
  });
}
