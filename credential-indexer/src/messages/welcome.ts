/**
 * @see [Welcome](https://github.com/will-break-it/wallet-architecture/blob/main/docs/CIP/CIP-XXXX/messages/server/welcome.md)
 */
export interface Welcome {
  blockchains: Chain[];
}

export interface Chain {
  name: string;
  network: string;
  extensions: Extension[];
}

export interface Extension {
  name: string;
  config: boolean;
  switchable: boolean;
  versions: string[];
}

export const CARDANO_PREPROD: Chain = {
  name: 'cardano',
  network: 'preprod',
  extensions: []
}
