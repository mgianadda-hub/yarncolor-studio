import "server-only";
import OpenAI, { toFile } from "openai";
import { appConfig, type ModelId } from "@/config/app.config";

// Creato alla prima richiesta: durante la build OPENAI_API_KEY può non essere disponibile.
let client: OpenAI | null = null;
function getClient(): OpenAI {
  // Hobby: le Function durano al massimo 300 s. Nessun retry automatico per non sforare.
  client ??= new OpenAI({ timeout: 290_000, maxRetries: 0 });
  return client;
}

export type EditInput = {
  master: File;
  /** Assente nella modalità "Da codice colore": si invia solo il master. */
  destination?: File;
  prompt: string;
  model: ModelId;
  size: string;
};

/**
 * Chiama images/edits con [master, destinazione] (o solo [master]) e restituisce il JPEG generato.
 */
export async function editImage(input: EditInput): Promise<Buffer> {
  const image = [
    await toFile(input.master, input.master.name || "master", { type: input.master.type }),
  ];
  if (input.destination) {
    image.push(
      await toFile(input.destination, input.destination.name || "destinazione", {
        type: input.destination.type,
      }),
    );
  }

  const response = await getClient().images.edit({
    model: input.model,
    image,
    prompt: input.prompt,
    size: input.size,
    quality: appConfig.quality,
    output_format: appConfig.outputFormat,
    output_compression: appConfig.outputCompression,
    n: 1,
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI non ha restituito alcuna immagine.");
  return Buffer.from(b64, "base64");
}

/** Traduce un errore (OpenAI o altro) in un messaggio leggibile e uno status HTTP. */
export function describeError(error: unknown): { status: number; message: string } {
  if (error instanceof OpenAI.OpenAIError && /OPENAI_API_KEY|credentials/i.test(error.message)) {
    return { status: 500, message: "OPENAI_API_KEY non è configurata sul server." };
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return { status: 504, message: "OpenAI non ha risposto in tempo. Riprova." };
  }
  if (error instanceof OpenAI.APIError) {
    const detail = error.message || "Errore sconosciuto";
    if (error.status === 401) {
      return { status: 500, message: "Chiave OpenAI non valida o mancante (OPENAI_API_KEY)." };
    }
    if (error.status === 429) {
      return { status: 429, message: `Limite di richieste OpenAI raggiunto. ${detail}` };
    }
    if (error.code === "moderation_blocked") {
      return { status: 400, message: `Richiesta bloccata dal sistema di moderazione di OpenAI. ${detail}` };
    }
    return { status: error.status && error.status < 500 ? 400 : 502, message: `OpenAI: ${detail}` };
  }
  return { status: 500, message: error instanceof Error ? error.message : "Errore sconosciuto." };
}
