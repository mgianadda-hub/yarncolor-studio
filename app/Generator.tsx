"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ImageIcon,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Settings,
  Sparkles,
} from "lucide-react";
import { appConfig } from "@/config/app.config";
import { hexDownloadName, sampleDownloadName } from "@/lib/filenames";
import { TARGET_HEX_PLACEHOLDER, normalizeHex } from "@/lib/hex";
import { computeOutputSize, readImageDimensions } from "@/lib/output-size";
import { formatMB, validateUploads } from "@/lib/upload";
import ColorCard from "./components/ColorCard";
import ModeSwitch, { type Mode } from "./components/ModeSwitch";
import ResultsSection, { type Result } from "./components/ResultsSection";
import UploadCard, { type SelectedImage } from "./components/UploadCard";

/** Input dell'ultima generazione: usati da "Riprova" e per i nomi dei file scaricati. */
type Job = {
  mode: Mode;
  master: File;
  destination?: File;
  /** Solo modalità "Da codice colore": esadecimale normalizzato e nome colore (quest'ultimo solo per il nome file). */
  hex?: string;
  colorName?: string;
  prompt: string;
  model: string;
  size?: string;
};

async function generateOne(job: Job): Promise<{ blob: Blob; size: string }> {
  const form = new FormData();
  form.append("mode", job.mode);
  form.append("master", job.master);
  if (job.mode === "sample" && job.destination) form.append("destination", job.destination);
  // Il nome colore non viene mai inviato: serve solo per il nome del file.
  if (job.mode === "hex" && job.hex) form.append("hex", job.hex);
  form.append("prompt", job.prompt);
  form.append("model", job.model);

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

function fileNameFor(job: Job, index: number, total: number): string {
  return job.mode === "hex"
    ? hexDownloadName(job.master.name, job.hex ?? "", job.colorName ?? "", index, total)
    : sampleDownloadName(job.master.name, job.destination?.name ?? "", index, total);
}

export default function Generator({
  defaultPrompts,
}: {
  defaultPrompts: Record<Mode, string>;
}) {
  const [mode, setMode] = useState<Mode>("sample");
  const [master, setMaster] = useState<SelectedImage | null>(null);
  const [destination, setDestination] = useState<SelectedImage | null>(null);
  const [hexInput, setHexInput] = useState("");
  const [colorName, setColorName] = useState("");
  // Ogni modalità ha il suo prompt; le modifiche valgono solo per questa sessione.
  const [prompts, setPrompts] = useState<Record<Mode, string>>(defaultPrompts);
  const [model, setModel] = useState<string>(appConfig.defaultModel);
  const [count, setCount] = useState<number>(appConfig.imageCountOptions[0]);
  const [results, setResults] = useState<Result[]>([]);
  const [, setTick] = useState(0);
  const resultUrls = useRef<string[]>([]);
  const [job, setJob] = useState<Job | null>(null);

  const running = results.some((r) => r.status === "pending");
  const prompt = prompts[mode];
  const defaultPrompt = defaultPrompts[mode];
  const setPrompt = (value: string) => setPrompts((prev) => ({ ...prev, [mode]: value }));

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

  const isHex = mode === "hex";
  const hex = normalizeHex(hexInput);
  const missingPlaceholder = isHex && !prompt.includes(TARGET_HEX_PLACEHOLDER);
  const uploadError = master
    ? isHex
      ? validateUploads(master.file, null, false)
      : destination
        ? validateUploads(master.file, destination.file)
        : null
    : null;

  const missing = !master
    ? "Carica l'immagine master."
    : !isHex && !destination
      ? "Carica l'immagine destinazione."
      : isHex && !hex
        ? hexInput.trim()
          ? "Il codice colore non è valido."
          : "Inserisci il codice esadecimale del colore."
        : !prompt.trim()
          ? "Il prompt è vuoto."
          : missingPlaceholder
            ? `Il prompt non contiene ${TARGET_HEX_PLACEHOLDER}.`
            : null;

  const canGenerate = !missing && !uploadError && master?.output?.ok === true && !running;
  const inputBytes = (master?.file.size ?? 0) + (!isHex ? (destination?.file.size ?? 0) : 0);

  function setResult(index: number, result: Result) {
    setResults((prev) => prev.map((r, i) => (i === index ? result : r)));
  }

  async function runSlot(index: number, current: Job) {
    const { model, size, hex } = current;
    const startedAt = Date.now();
    setResult(index, { status: "pending", startedAt, model, size, hex });
    try {
      const { blob, size: outputSize } = await generateOne(current);
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
        hex,
        finishedAt,
      });
    } catch (e) {
      setResult(index, {
        status: "error",
        error: e instanceof Error ? e.message : "Errore sconosciuto.",
        model,
        hex,
      });
    }
  }

  function generate() {
    if (!master || !canGenerate) return;
    resultUrls.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrls.current = [];
    const current: Job = {
      mode,
      master: master.file,
      destination: isHex ? undefined : destination?.file,
      hex: isHex ? (hex ?? undefined) : undefined,
      colorName: isHex ? colorName : undefined,
      prompt,
      model,
      size: master.output?.ok ? master.output.size : undefined,
    };
    setJob(current);
    if (isHex && hex) setHexInput(hex);
    const startedAt = Date.now();
    setResults(
      Array.from({ length: count }, () => ({
        status: "pending",
        startedAt,
        model,
        size: current.size,
        hex: current.hex,
      })),
    );
    // Una chiamata per immagine, in parallelo: ognuna parte dal master.
    for (let i = 0; i < count; i++) void runSlot(i, current);
  }

  const fileNameExample =
    isHex && hex
      ? hexDownloadName(master?.file.name || "master", hex, colorName, 0, count)
      : null;

  return (
    <div className="stack-lg">
      <ModeSwitch mode={mode} disabled={running} onChange={setMode} />

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
        {isHex ? (
          <ColorCard
            step={2}
            hexInput={hexInput}
            colorName={colorName}
            disabled={running}
            fileNameExample={fileNameExample}
            onHexChange={setHexInput}
            onColorNameChange={setColorName}
          />
        ) : (
          <UploadCard
            step={2}
            title="Immagine destinazione"
            hint="Il dettaglio del filato con il colore da applicare."
            image={destination}
            disabled={running}
            onSelect={(f) => selectImage(f, "destination")}
          />
        )}
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
          {missingPlaceholder && (
            <div className="callout callout-error prompt-warning" role="alert">
              <CircleAlert size={20} aria-hidden="true" />
              <div>
                Il prompt non contiene <code>{TARGET_HEX_PLACEHOLDER}</code>: senza il segnaposto il colore
                non arriverebbe al modello. Aggiungilo oppure premi «Ripristina».
              </div>
            </div>
          )}
          <p className="hint-row">
            {prompt === defaultPrompt ? "Prompt di default" : "Prompt modificato"}
            {isHex ? " (Da codice colore)" : " (Da campione)"} · {prompt.length.toLocaleString("it-IT")}{" "}
            caratteri
            {isHex && !missingPlaceholder && (
              <>
                {" "}
                · <code>{TARGET_HEX_PLACEHOLDER}</code> sarà sostituito con {hex ?? "il codice colore"}
              </>
            )}
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
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={generate}
              disabled={!canGenerate}
            >
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
              <p className={`hint-row center${uploadError || missingPlaceholder ? " error" : ""}`}>
                {uploadError ?? missing}
              </p>
            )}
            {!running && !uploadError && !missing && (
              <p className="hint-row center">
                Input: {formatMB(inputBytes)} su {formatMB(appConfig.maxUploadTotalBytes)}
              </p>
            )}
          </div>
        </div>
      </section>

      <ResultsSection
        results={results}
        canRetry={!running && !!job}
        fileName={(i) => (job ? fileNameFor(job, i, results.length) : "immagine.jpg")}
        onRetry={(i) => job && void runSlot(i, job)}
      />
    </div>
  );
}
