import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Legge il prompt di default da config/default-prompt.txt, così com'è. */
export function readDefaultPrompt(): Promise<string> {
  return readFile(path.join(process.cwd(), "config", "default-prompt.txt"), "utf8");
}
