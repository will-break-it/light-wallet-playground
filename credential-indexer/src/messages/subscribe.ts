import { ClientMessage } from "./clientMessage";

/** @see [Subscribe](https://github.com/will-break-it/wallet-architecture/blob/main/docs/CIP/CIP-XXXX/messages/client/subscribe.md) */
export interface Subscribe extends ClientMessage {
  type: "subscribe";
  credentials: string[];
}

export interface SubscribableChainId {
  name: string;
  network: string;
}

export interface SubscribeChain {}
