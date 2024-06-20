/** Defines heartbeat interval. */
export const HEARTBEAT_INTERVAL_MS = 30_080;

/** Defines web socket server port. */
export const WEBSOCKET_PORT = 8080;

/** Defines after how many processed transactions std out logging occurs. */
export const TX_LOG_INTERVAL = 500;

/** Defines the bloom filter false-positive rate (FPR) */
export const ACCEPTABLE_FPR = 0.001;

/** Defines the CSV export header */
export const CSV_HEADER = [
  "time",
  `avg duration (FPR ${ACCEPTABLE_FPR})`,
  `# matched txs (FPR ${ACCEPTABLE_FPR})`,
  `# processed txs (FPR ${ACCEPTABLE_FPR})`,
  `# matched bytes (FPR ${ACCEPTABLE_FPR})`,
  `# processed bytes (FPR ${ACCEPTABLE_FPR})`,
  `# last tx hash (FPR ${ACCEPTABLE_FPR})`,
];
