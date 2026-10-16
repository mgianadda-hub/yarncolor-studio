import { NextResponse } from "next/server";
import { isAllowedModel } from "@/config/app.config";
import { describeError, editImage } from "@/lib/openai-edit";
import { computeOutputSize, readImageDimensions } from "@/lib/output-size";
import { validateUploads } from "@/lib/upload";

export const runtime = "nodejs";
// Piano Hobby: massimo 300 secondi per Function.
export const maxDuration = 300;

/** Genera UNA immagine partendo da master e destinazione. Restituisce il JPEG in binario. */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });

  const master = form.get("master");
  const destination = form.get("destination");
  const prompt = String(form.get("prompt") ?? "");
  const model = String(form.get("model") ?? "");

  const uploadError = validateUploads(master, destination);
  if (uploadError) return NextResponse.json({ error: uploadError }, { status: 400 });
  if (!isAllowedModel(model)) {
    return NextResponse.json({ error: `Modello non consentito: ${model}` }, { status: 400 });
  }
  if (!prompt.trim()) return NextResponse.json({ error: "Il prompt è vuoto." }, { status: 400 });
  if (prompt.length > 32000) {
    return NextResponse.json(
      { error: "Il prompt supera i 32.000 caratteri ammessi da OpenAI." },
      { status: 400 },
    );
  }

  const masterFile = master as File;
  let output;
  try {
    output = computeOutputSize(readImageDimensions(new Uint8Array(await masterFile.arrayBuffer())));
  } catch {
    return NextResponse.json(
      { error: "Impossibile leggere le dimensioni del master." },
      { status: 400 },
    );
  }
  if (!output.ok) return NextResponse.json({ error: output.error }, { status: 400 });

  try {
    const jpeg = await editImage({
      master: masterFile,
      destination: destination as File,
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
