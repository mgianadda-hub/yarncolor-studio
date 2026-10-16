// TEMPORANEO: route dello smoke test, da rimuovere dopo la verifica sul deploy di anteprima.
import { NextResponse } from "next/server";
import { isAllowedModel } from "@/config/app.config";
import { describeError, editImage } from "@/lib/openai-edit";
import { computeOutputSize, readImageDimensions } from "@/lib/output-size";
import { validateUploads } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const form = await request.formData();
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

  const masterFile = master as File;
  const output = computeOutputSize(
    readImageDimensions(new Uint8Array(await masterFile.arrayBuffer())),
  );
  if (!output.ok) return NextResponse.json({ error: output.error }, { status: 400 });

  const started = Date.now();
  try {
    const jpeg = await editImage({
      master: masterFile,
      destination: destination as File,
      prompt,
      model,
      size: output.size,
    });
    const durationMs = Date.now() - started;
    const actual = readImageDimensions(jpeg);
    return new Response(new Uint8Array(jpeg), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Requested-Size": output.size,
        "X-Output-Size": `${actual.width}x${actual.height}`,
        "X-Duration-Ms": String(durationMs),
      },
    });
  } catch (error) {
    const { status, message } = describeError(error);
    return NextResponse.json(
      { error: message, durationMs: Date.now() - started },
      { status },
    );
  }
}
