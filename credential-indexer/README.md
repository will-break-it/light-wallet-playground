# Credential-based indexing of transactions

This repository makes use of an updated version of the cardano-js-sdk to project transactions indexed by involved credentials, such as payment or stake key hashes.

The aim is to have clients provide credentials to the serve during the initial handshake after establishing a connection with the server. Subsequently, they'll receive a stream of **relevant** transactions which were indexed to have the one of their provided credentials involved.

## How to run

We are using a not merged version of the [cardano-js-sdk](https://github.com/will-break-it/cardano-js-sdk) that implements the new credential-based projection for transactions. Hence, we link it after building it:

### 1. Build SDK

```bash
yarn build:sdk
```

### 2. Link SDK

```bash
yarn link:sdk
```

### 3. Run & connect to Cardano

Make sure docker daemon is running, because this will start ogmios, cardano-node and postgres containers.

```bash
yarn connect
```

### 4. Start projection

In a separate terminal start the projection via:

```bash
yarn project
```

### 5. Build & Start websocket server

In a separate terminal type the following in the credential-indexer directory:

```bash
yarn && yarn build && yarn start
```

### 6. Run local http to simulate client

Lastly, open another terminal and start a local http server in the credential-indexer directory:

```bash
python -m http.server
```

You should now be able to open your browser at:

[https://localhost:8080/client.html](https://localhost:8080/client.html)

After running the projection service for a bit, you should a couple transactions based on the hardcoded credentials in the client.html file.