import { join } from "https://deno.land/std@0.177.0/path/mod.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { C } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { ACCEPTABLE_FPR } from "./constants.ts";

/** Encodes bech32 address to base64. */
export function bech32ToBase64(addr: string): string {
  return encodeBase64(C.Address.from_bech32(addr).to_bytes());
}

/** Creates/ truncates log file for metrices */
export async function createLogfile(prefix: string): Promise<Deno.FsFile> {
  const dir = join("metrics");
  await ensureDir(dir);
  const filePath = join(dir, `${prefix}-fpr-${ACCEPTABLE_FPR}.csv`);
  const file = await Deno.open(filePath, {
    write: true,
    create: true,
    truncate: true,
  });
  return file;
}
