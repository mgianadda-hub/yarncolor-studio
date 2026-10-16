"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LoaderCircle, Pencil, RotateCcw, Settings, Sparkles, ImageIcon } from "lucide-react";
import { appConfig } from "@/config/app.config";
import { computeOutputSize, readImageDimensions } from "@/lib/output-size";
import { formatMB, validateUploads } from "@/lib/upload";
import ResultsSection, { type Result } from "./components/ResultsSection";
import UploadCard, { type SelectedImage } from "./components/UploadCard";

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

/**
 * Nome del file scaricato: <master>-<destinazione>.jpg; con più immagini si aggiunge
 * -1, -2, -3 (es. gomitolo_mohair-rosso-2.jpg).
 */
function downloadName(masterName: string, destinationName: string, index: number, total: number) {
  const base = [baseName(masterName), baseName(destinationName)].filter(Boolean).join("-") || "immagine";
  return total > 1 ? `${base}-${index + 1}.jpg` : `${base}.jpg`;
}

async function generateOne(
  master: File,
  destination: File,
  prompt: string,
  model: string,
): Promise<{ blob: Blob; size: string }> {
  const form = new FormData();
  form.append("master", master);
  form.append("destination", destination);
  form.append("prompt", prompt);
  form.append("model", model);

  const response = await fetch("/api/generate", { method: "POST", body: form });
  if (response.ok) {
    return { blob: await response.blob(), size: response.headers.get("X-Output-Size") ?? "" };
  }

  const text = await response.text();
  try {
    const message = (JSON.parse(text) as { error?: string }).error;
    if (message) throw new Error(message);
  } catch (e) {
    if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
  }
  if (response.status === 413) throw new Error("Le immagini sono troppo pesanti per il server.");
  if (response.status === 504) {
    throw new Error("Tempo massimo superato (300 s). Riprova o scegli un modello più veloce.");
  }
  throw new Error(`Errore del server (HTTP ${response.status}).`);
}

type Job = {
  master: File;
  destination: File;
  prompt: string;
  model: string;
  size?: string;
};

export default function Generator({ defaultPrompt }: { defaultPrompt: string }) {
  const [master, setMaster] = useState<SelectedImage | null>(null);
  const [destination, setDestination] = useState<SelectedImage | null>(null);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [model, setModel] = useState<string>(appConfig.defaultModel);
  const [count, setCount] = useState<number>(appConfig.imageCountOptions[0]);
  const [results, setResults] = useState<Result[]>([]);
  const [, setTick] = useState(0);
  const resultUrls = useRef<string[]>([]);
  // Input dell'ultima generazione: usati da "Riprova" e per i nomi dei file scaricati.
  const [job, setJob] = useState<Job | null>(null);

  const running = results.some((r) => r.status === "pending");

  // Aggiorna i contatori dei secondi mentre la generazione è in corso.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function selectImage(file: File | null, kind: "master" | "destination") {
    const setter = kind === "master" ? setMaster : setDestination;
    setter((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (!file) return;
    const accepted: readonly string[] = appConfig.acceptedImageTypes;
    const selected: SelectedImage = { file, previewUrl: URL.createObjectURL(file) };
    if (kind === "master") {
      if (!accepted.includes(file.type)) {
        selected.output = { ok: false, error: "Formato non supportato: usa JPG, PNG o WebP." };
      } else {
        try {
          const dims = readImageDimensions(new Uint8Array(await file.arrayBuffer()));
          Object.assign(selected, dims, { output: computeOutputSize(dims) });
        } catch {
          selected.output = { ok: false, error: "Impossibile leggere le dimensioni del master." };
        }
      }
    }
    setter(selected);
  }

  const uploadError = master && destination ? validateUploads(master.file, destination.file) : null;
  const canGenerate =
    !!master &&
    !!destination &&
    !uploadError &&
    master.output?.ok === true &&
    prompt.trim().length > 0 &&
    !running;

  const missing = !master
    ? "Carica l'immagine master."
    : !destination
      ? "Carica l'immagine destinazione."
      : !prompt.trim()
        ? "Il prompt è vuoto."
        : null;

  function setResult(index: number, result: Result) {
    setResults((prev) => prev.map((r, i) => (i === index ? result : r)));
  }

  async function runSlot(index: number, current: Job) {
    const { model, size } = current;
    const startedAt = Date.now();
    setResult(index, { status: "pending", startedAt, model, size });
    try {
      const { blob, size: outputSize } = await generateOne(
        current.master,
        current.destination,
        current.prompt,
        model,
      );
      const url = URL.createObjectURL(blob);
      resultUrls.current.push(url);
      const finishedAt = Date.now();
      setResult(index, {
        status: "ok",
        url,
        seconds: Math.round((finishedAt - startedAt) / 1000),
        bytes: blob.size,
        size: outputSize || size || "",
        model,
        finishedAt,
      });
    } catch (e) {
      setResult(index, {
        status: "error",
        error: e instanceof Error ? e.message : "Errore sconosciuto.",
        model,
      });
    }
  }

  function generate() {
    if (!master || !destination) return;
    resultUrls.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrls.current = [];
    const current: Job = {
      master: master.file,
      destination: destination.file,
      prompt,
      model,
      size: master.output?.ok ? master.output.size : undefined,
    };
    setJob(current);
    const startedAt = Date.now();
    setResults(
      Array.from({ length: count }, () => ({ status: "pending", startedAt, model, size: current.size })),
    );
    // Una chiamata per immagine, in parallelo: ognuna parte da master e destinazione.
    for (let i = 0; i < count; i++) void runSlot(i, current);
  }

  return (
    <div className="stack-lg">
      <div className="inputs-grid">
        <UploadCard
          step={1}
          title="Immagine master"
          hint="La foto del gomitolo da ricolorare."
          image={master}
          disabled={running}
          showSizes
          onSelect={(f) => selectImage(f, "master")}
        />
        <UploadCard
          step={2}
          title="Immagine destinazione"
          hint="Il dettaglio del filato con il colore da applicare."
          image={destination}
          disabled={running}
          onSelect={(f) => selectImage(f, "destination")}
        />
      </div>

      <section className="card workbench">
        <div className="prompt-panel">
          <header className="card-header">
            <span className="icon-badge">
              <Pencil size={18} aria-hidden="true" />
            </span>
            <div>
              <h2>
                <label htmlFor="prompt">Prompt</label>
              </h2>
              <p>Le modifiche valgono solo per questa sessione e non vengono salvate.</p>
            </div>
            {prompt !== defaultPrompt && (
              <button
                type="button"
                className="btn btn-ghost btn-sm header-action"
                disabled={running}
                onClick={() => setPrompt(defaultPrompt)}
              >
                <RotateCcw size={15} aria-hidden="true" /> Ripristina
              </button>
            )}
          </header>
          <textarea
            id="prompt"
            className="prompt-input"
            value={prompt}
            disabled={running}
            spellCheck={false}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <p className="hint-row">
            {prompt === defaultPrompt ? "Prompt di default" : "Prompt modificato"} ·{" "}
            {prompt.length.toLocaleString("it-IT")} caratteri
          </p>
        </div>

        <div className="settings-panel">
          <header className="card-header">
            <span className="icon-badge">
              <Settings size={18} aria-hidden="true" />
            </span>
            <div>
              <h2>Impostazioni</h2>
            </div>
          </header>

          <div className="field">
            <label htmlFor="model" className="field-label">
              Modello
            </label>
            <div className="select-wrap">
              <Sparkles size={18} className="select-icon" aria-hidden="true" />
              <select id="model" value={model} disabled={running} onChange={(e) => setModel(e.target.value)}>
                {appConfig.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}
                    {m.note ? ` (${m.note})` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="select-chevron" aria-hidden="true" />
            </div>
          </div>

          <fieldset className="field">
            <legend className="field-label">
              <ImageIcon size={16} aria-hidden="true" /> Numero di immagini
            </legend>
            <div className="segmented">
              {appConfig.imageCountOptions.map((n) => (
                <label key={n} className={`segment${count === n ? " is-active" : ""}`}>
                  <input
                    type="radio"
                    name="count"
                    value={n}
                    checked={count === n}
                    disabled={running}
                    onChange={() => setCount(n)}
                  />
                  {n === 1 ? "1 immagine" : `${n} immagini`}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="generate-area">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={generate} disabled={!canGenerate}>
              {running ? (
                <>
                  <LoaderCircle size={20} className="spin" aria-hidden="true" /> Generazione in corso…
                </>
              ) : (
                <>
                  <Sparkles size={20} aria-hidden="true" />
                  {count === 1 ? "Genera immagine" : `Genera ${count} immagini`}
                  <ChevronRight size={20} aria-hidden="true" />
                </>
              )}
            </button>
            {!running && (uploadError || missing) && (
              <p className={`hint-row center${uploadError ? " error" : ""}`}>{uploadError ?? missing}</p>
            )}
            {!running && !uploadError && !missing && master && destination && (
              <p className="hint-row center">
                Input: {formatMB(master.file.size + destination.file.size)} su{" "}
                {formatMB(appConfig.maxUploadTotalBytes)}
              </p>
            )}
          </div>
        </div>
      </section>

      <ResultsSection
        results={results}
        canRetry={!running && !!job}
        fileName={(i) =>
          downloadName(job?.master.name ?? "", job?.destination.name ?? "", i, results.length)
        }
        onRetry={(i) => job && void runSlot(i, job)}
      />
    </div>
  );
}
