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

#### 3.1 Setup Postgres notifications

In order to receive notifications from postgres, you have to run two sql scripts to get notified for new inserts of blocks.
You can either use pgAdmin or the terminal from the postgres docker container if you have [`psql`](https://www.timescale.com/blog/how-to-install-psql-on-mac-ubuntu-debian-windows/) installed.

##### pgAdmin

Open pgAdmin and open the query tool, then:

- copy & paste the [new_block function](./sql/notify_new_block.function.sql) and execute the SQL

```sql
  CREATE OR REPLACE FUNCTION notify_new_block()
  RETURNS TRIGGER AS $$
  DECLARE
    payload TEXT;
  BEGIN
    payload := row_to_json(NEW);
    PERFORM pg_notify('new_block', payload);
    RETURN NEW;
  END;
  $$

  LANGUAGE plpgsql;
```

- copy & paste the [new_block trigger](./sql/notify_new_block.trigger.sql) and execute

```sql
  CREATE TRIGGER notify_new_block_trigger
  AFTER INSERT ON block
  FOR EACH ROW
  EXECUTE PROCEDURE notify_new_block();
```

##### Docker Postgres Terminal

Open docker and find the postgres container, there should be an option to `Open in Terminal`, then connect by inserting:

```bash
psql -U postgres -d projection
```

After that you should be in the psql cli terminal and you can copy and paste the same sql scripts reference above.

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

## Potential Problem Hints

### Invalid port for ogmios

Error:

> `* error decoding 'Ports': Invalid hostPort: -1339}`

If you're seeing the above error, open the [`.env.preprod`](./cardano-js-sdk/packages/cardano-services/environments/.env.preprod) file and update the `OGMIOS_PORT`:

```env
OGMIOS_PORT=1339
```

Try again.

### Type errors

If you're adding dependencies, you'll have to re-link the SDK.

## Testing (Benchmark)

You will need to run the `connect` and optionally the `projection` command, unless you don't want the most recent data.
The test isn't current testing as there a continously growing number of tx counts.

```bash
yarn test:bench
```
