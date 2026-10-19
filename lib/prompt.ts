import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

function readConfigFile(name: string): Promise<string> {
  return readFile(path.join(process.cwd(), "config", name), "utf8");
}

/** Prompt di default della modalità "Da campione" (config/default-prompt.txt), così com'è. */
export function readDefaultPrompt(): Promise<string> {
  return readConfigFile("default-prompt.txt");
}

/** Prompt di default della modalità "Da codice colore" (config/hex-prompt.txt), così com'è. */
export function readHexPrompt(): Promise<string> {
  return readConfigFile("hex-prompt.txt");
}
