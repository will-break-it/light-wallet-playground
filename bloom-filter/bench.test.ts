import * as mainnet_addresses from "../mainnet-addresses.json" with { type: "json" };

type ClientAddress = {
  tx_count: number;
  address: string;
  stake_address: string;
};

const CLIENT_COUNT = 100;
const clients: WebSocket[] = [];
const addresses: ClientAddress[] = mainnet_addresses.default.slice(
  0,
  CLIENT_COUNT
);
let isConnectedCount = 0;

for (let i = 0; i < CLIENT_COUNT; i++) {
  setTimeout(() => {
    const client = createClient(
      i,
      "ws://localhost:8080",
      addresses.at(i)!.address
    );
    clients.push(client);
  }, 10*i);
}

export function createClient(
  id: number,
  url: string,
  address: string
): WebSocket {
  const client = new WebSocket(url);
  client.addEventListener("open", () => {
    increaseConnected();
    client.send(
      JSON.stringify({
        type: "set_filter",
        address,
        credentials: null,
      })
    );
  });

  client.addEventListener("error", () => {
    console.error(`[${id}] Received Error`);
    decreaseConnected();
  });
  
  client.addEventListener("close", () => {
    console.log(`[${id}] Received Close`);
    decreaseConnected();
  });
  
  return client;
}

Deno.addSignalListener("SIGINT", () => {
  console.log("Received SIGINT signal...");
  clients.forEach(async c => await c.close());
  Deno.exit(0);
});

function increaseConnected() {
  isConnectedCount += 1;

  if (isConnectedCount % (CLIENT_COUNT / 10) == 0) {
    console.log(`${isConnectedCount} clients connected.`)
  }
}

function decreaseConnected() {
  isConnectedCount -= 1;
}