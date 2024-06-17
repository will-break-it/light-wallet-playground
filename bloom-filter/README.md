# Bloom filters

This project is a small prototype which subscribes to a stream of blocks via [Oura](https://oura.txpipe.io/), parses, transforms and filters it down to
client specified filters via a [bloom](https://github.com/Callidon/bloom-filters) filter data structure. The idea is predominantly copied from [BIP-37](https://github.com/bitcoin/bips/blob/master/bip-0037.mediawiki).
This prototype showcases how a stream of transactinos can be derived based on clients' filter preference while also collecting some metrics around
false-positives rates (FPR) and data transmitted rate (DTR).

## Goal

The goal isn't technical feasiability, but more so demonstrating limitations of this architecture with specific numbers such as:
- false-positives rate (FPR)
  > How many irrelevant transactions are forwarded to clients?
- data transmitted rate (DTR)
  > How much data is actually transmitted vs. total data processed by server?

## Run

Before running the actual pipeline, you'll need to build Oura v2 binary which is referenced as git submodule in the subdirectory `oura`. Oura v2 can be built from the `main` branch by typing the following command from inside the `oura` directory:

#### Prerequisites

```bash
cargo build --features rabbitmq --release
```

#### Steps

1. Setup rabbitMq (Oura sink):
> Run from repository root:
```bash
docker compose up
```
2. Run `server.ts` :
> This creates a websocket server while also subscribing to rabbitMq's channel to observe incoming transactions.
> Furthermore, it publishes any matches passing a hardcoded bloom filter to connected clients.

```bash
deno run --allow-net --allow-read --allow-env --allow-write src/websocket-server.ts
```

3. Open `client.html`:
> Run a local http server from this directory and open the [client html file](http://localhost:8000/client.html), which connects as websocket client to the server.
```bash
python -m http.server 8000 && chrome http://localhost:3000/client.html
```

4. Run `oura`:

Once, the build process has finished, the `oura` binary can be found in `./oura/target/release/oura`.
Now be run from the repository root directory via: 
```bash
./oura/target/release/oura daemon --config config/daemon.toml
```

## Note

Ensure you have a client connected by opening the html file, otherwise you won't see incoming transactions as the server will only subscribe to `oura`
once a client connects.


## Metrics

By default there are some constants defined to observe a specific wallet address that can be changed via the `WALLET_ADDRESS` constants.
In a production like solution, client would greet after establishing a websocket connection by sharing their address(es) to be observed.

The metrics are logged by wallet address and named according to the set expected false-positive error rate.

> Important:
Metric files are overridden when multiple runs with the FPR are done.