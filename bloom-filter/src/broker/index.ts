import { connect } from "https://deno.land/x/amqp@v0.24.0/mod.ts";

/** Defines the rabbitMQ URL */
const RABBITMQ_URL = "amqp://rabbitmq:rabbitmq@localhost:5672";
/** Defines the rabbitMQ exchange */
const EXCHANGE_NAME = "events.exchange";
/** Defines the rabbitMQ channel name */
export const QUEUE_NAME = "cardano";

/// :- RabbitMq Connection Setup
const connection = await connect(RABBITMQ_URL);
const channel = await connection.openChannel();

await channel.declareExchange({ exchange: EXCHANGE_NAME, type: "direct" });
await channel.declareQueue({ queue: QUEUE_NAME, durable: true });
await channel.bindQueue({
  queue: QUEUE_NAME,
  exchange: EXCHANGE_NAME,
  routingKey: "",
});

export default channel;
