import { BloomFilter } from "https://esm.sh/bloom-filters@3.0.1";
import { ACCEPTABLE_FPR } from "../../constants.ts";
import { bech32ToBase64 } from "../../utils.ts";
import { SetFilterMessageContext, SetFilterMessage } from "../types.ts";

/**
 * Processes a message of type `set_filter`.
 *
 * @param message: Defines the message received by a websocket client to set a new bloom filter.
 * @param context: Holds the context required to add a new client with filters.
 */
export function handleSetFilter(
  message: SetFilterMessage,
  { setFilter }: SetFilterMessageContext
) {
  const filterInputs: string[] = [];
  if (message.address) {
    try {
      filterInputs.push(bech32ToBase64(message.address));
    } catch (error) {
      console.error(`Invalid address:\n`, message.address, "\nError:", error);
    }
  }
  if (message.credentials) {
    filterInputs.push(message.credentials.paymentKeyHash);
    if (message.credentials.stakingKeyHash) {
      filterInputs.push(message.credentials.stakingKeyHash);
    }
  }

  if (filterInputs.length > 0) {
    const filter = BloomFilter.from(filterInputs, ACCEPTABLE_FPR);
    setFilter(filter);
  } else {
    setFilter(null);
  }
}
