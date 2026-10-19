import { NextResponse } from "next/server";
import { isAllowedModel } from "@/config/app.config";
import { TARGET_HEX_PLACEHOLDER, fillHexPrompt, normalizeHex } from "@/lib/hex";
import { describeError, editImage } from "@/lib/openai-edit";
import { computeOutputSize, readImageDimensions } from "@/lib/output-size";
import { validateUploads } from "@/lib/upload";

export const runtime = "nodejs";
// Piano Hobby: massimo 300 secondi per Function.
export const maxDuration = 300;

const MAX_PROMPT_LENGTH = 32000;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Genera UNA immagine. Modalità:
 * - "sample" (Da campione): master + destinazione;
 * - "hex" (Da codice colore): solo master; {TARGET_HEX} nel prompt diventa l'esadecimale normalizzato.
 * Restituisce il JPEG in binario.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return badRequest("Richiesta non valida.");

  const mode = String(form.get("mode") ?? "sample");
  if (mode !== "sample" && mode !== "hex") return badRequest(`Modalità non valida: ${mode}`);

  const master = form.get("master");
  const destination = mode === "sample" ? form.get("destination") : null;
  let prompt = String(form.get("prompt") ?? "");
  const model = String(form.get("model") ?? "");

  const uploadError = validateUploads(master, destination, mode === "sample");
  if (uploadError) return badRequest(uploadError);
  if (!isAllowedModel(model)) return badRequest(`Modello non consentito: ${model}`);
  if (!prompt.trim()) return badRequest("Il prompt è vuoto.");

  if (mode === "hex") {
    const hex = normalizeHex(String(form.get("hex") ?? ""));
    if (!hex) return badRequest("Codice colore non valido: usa 6 cifre esadecimali, es. #1A2B3C.");
    if (!prompt.includes(TARGET_HEX_PLACEHOLDER)) {
      return badRequest(
        `Il prompt non contiene ${TARGET_HEX_PLACEHOLDER}: senza il segnaposto il colore non arriverebbe al modello.`,
      );
    }
    prompt = fillHexPrompt(prompt, hex);
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return badRequest("Il prompt supera i 32.000 caratteri ammessi da OpenAI.");
  }

  const masterFile = master as File;
  let output;
  try {
    output = computeOutputSize(readImageDimensions(new Uint8Array(await masterFile.arrayBuffer())));
  } catch {
    return badRequest("Impossibile leggere le dimensioni del master.");
  }
  if (!output.ok) return badRequest(output.error);

  try {
    const jpeg = await editImage({
      master: masterFile,
      destination: mode === "sample" ? (destination as File) : undefined,
      prompt,
      model,
      size: output.size,
    });
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Output-Size": output.size,
      },
    });
  } catch (error) {
    const { status, message } = describeError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
