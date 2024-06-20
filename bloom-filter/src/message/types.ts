import { BloomFilter } from "https://esm.sh/v135/bloom-filters@3.0.1/dist/api.js";

export type MessageType = "set_filter" | "heartbeat";
export interface Message {
  type: MessageType;
}

interface Credentials {
  paymentKeyHash: string;
  stakingKeyHash: string | null;
}
export interface SetFilterMessage {
  address: string | null;
  credentials: Credentials | null;
}

export type OptionalFilter = BloomFilter | undefined | null;
export interface SetFilterMessageContext {
  setFilter: (filter: OptionalFilter) => void;
}
