"use client";

import { useEffect, useRef, useState } from "react";
import { appConfig } from "@/config/app.config";
import { computeOutputSize, readImageDimensions, type OutputSizeResult } from "@/lib/output-size";
import { formatMB, validateUploads } from "@/lib/upload";

type SelectedImage = {
  file: File;
  previewUrl: string;
  width?: number;
  height?: number;
  output?: OutputSizeResult;
};

type Result =
  | { status: "pending"; startedAt: number }
  | { status: "ok"; url: string; seconds: number }
  | { status: "error"; error: string };

/** Nome del file scaricato: nome del master senza estensione + _1, _2, _3. */
function downloadName(masterName: string, index: number): string {
  const base = masterName.replace(/\.[^.]+$/, "") || "immagine";
  return `${base}_${index + 1}.jpg`;
}

async function generateOne(
  master: File,
  destination: File,
  prompt: string,
  model: string,
): Promise<Blob> {
  const form = new FormData();
  form.append("master", master);
  form.append("destination", destination);
  form.append("prompt", prompt);
  form.append("model", model);

  const response = await fetch("/api/generate", { method: "POST", body: form });
  if (response.ok) return response.blob();

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

export default function Generator({ defaultPrompt }: { defaultPrompt: string }) {
  const [master, setMaster] = useState<SelectedImage | null>(null);
  const [destination, setDestination] = useState<SelectedImage | null>(null);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [model, setModel] = useState<string>(appConfig.defaultModel);
  const [count, setCount] = useState<number>(appConfig.imageCountOptions[0]);
  const [results, setResults] = useState<Result[]>([]);
  const [, setTick] = useState(0);
  const resultUrls = useRef<string[]>([]);

  const running = results.some((r) => r.status === "pending");

  // Aggiorna il contatore dei secondi mentre la generazione è in corso.
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
    const selected: SelectedImage = { file, previewUrl: URL.createObjectURL(file) };
    if (kind === "master") {
      try {
        const dims = readImageDimensions(new Uint8Array(await file.arrayBuffer()));
        Object.assign(selected, dims, { output: computeOutputSize(dims) });
      } catch {
        selected.output = { ok: false, error: "Impossibile leggere le dimensioni del master." };
      }
    }
    setter(selected);
  }

  const uploadError =
    master && destination ? validateUploads(master.file, destination.file) : null;
  const canGenerate =
    !!master &&
    !!destination &&
    !uploadError &&
    master.output?.ok === true &&
    prompt.trim().length > 0 &&
    !running;

  function setResult(index: number, result: Result) {
    setResults((prev) => prev.map((r, i) => (i === index ? result : r)));
  }

  async function runSlot(index: number) {
    if (!master || !destination) return;
    const startedAt = Date.now();
    setResult(index, { status: "pending", startedAt });
    try {
      const blob = await generateOne(master.file, destination.file, prompt, model);
      const url = URL.createObjectURL(blob);
      resultUrls.current.push(url);
      setResult(index, { status: "ok", url, seconds: Math.round((Date.now() - startedAt) / 1000) });
    } catch (e) {
      setResult(index, {
        status: "error",
        error: e instanceof Error ? e.message : "Errore sconosciuto.",
      });
    }
  }

  function generate() {
    resultUrls.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrls.current = [];
    const startedAt = Date.now();
    setResults(Array.from({ length: count }, () => ({ status: "pending", startedAt })));
    // Una chiamata per immagine, in parallelo: ognuna parte da master e destinazione.
    for (let i = 0; i < count; i++) void runSlot(i);
  }

  return (
    <div className="stack">
      <section className="upload-grid">
        <UploadCard
          id="master"
          title="1. Immagine master"
          hint="La foto del gomitolo da ricolorare."
          image={master}
          disabled={running}
          onSelect={(f) => selectImage(f, "master")}
        >
          {master?.width && (
            <p className="small" style={{ margin: 0 }}>
              Master {master.width}×{master.height}
            </p>
          )}
          {master?.output &&
            (master.output.ok ? (
              <p style={{ margin: 0 }}>
                Verrà generata a{" "}
                <strong>
                  {master.output.width}×{master.output.height}
                </strong>
              </p>
            ) : (
              <p className="error" style={{ margin: 0 }}>{master.output.error}</p>
            ))}
        </UploadCard>
        <UploadCard
          id="destination"
          title="2. Immagine destinazione"
          hint="Il dettaglio del filato con il colore da applicare."
          image={destination}
          disabled={running}
          onSelect={(f) => selectImage(f, "destination")}
        />
      </section>
      {master && destination && (
        <p className={uploadError ? "error" : "muted small"} style={{ margin: 0 }}>
          {uploadError ??
            `Peso totale: ${formatMB(master.file.size + destination.file.size)} (massimo ${formatMB(appConfig.maxUploadTotalBytes)})`}
        </p>
      )}

      <section className="card stack">
        <div>
          <div className="row-between">
            <label htmlFor="prompt">Prompt</label>
            {prompt !== defaultPrompt && (
              <button
                type="button"
                className="link"
                disabled={running}
                onClick={() => setPrompt(defaultPrompt)}
              >
                Ripristina il prompt di default
              </button>
            )}
          </div>
          <p className="muted small" style={{ margin: "0 0 6px" }}>
            Le modifiche valgono solo per questa sessione e non vengono salvate.
          </p>
          <textarea
            id="prompt"
            rows={12}
            value={prompt}
            disabled={running}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="options-grid">
          <div>
            <label htmlFor="model">Modello</label>
            <select
              id="model"
              value={model}
              disabled={running}
              onChange={(e) => setModel(e.target.value)}
            >
              {appConfig.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.note ? ` (${m.note})` : ""}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="plain">
            <legend>Numero di immagini</legend>
            <div className="radio-row">
              {appConfig.imageCountOptions.map((n) => (
                <label key={n} className="radio">
                  <input
                    type="radio"
                    name="count"
                    value={n}
                    checked={count === n}
                    disabled={running}
                    onChange={() => setCount(n)}
                  />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <button type="button" onClick={generate} disabled={!canGenerate}>
            {running ? "Generazione in corso…" : count === 1 ? "Genera immagine" : `Genera ${count} immagini`}
          </button>
        </div>
      </section>

      {results.length > 0 && (
        <section className="results-grid">
          {results.map((r, i) => (
            <div key={i} className="card stack">
              <strong>Immagine {i + 1}</strong>
              {r.status === "pending" && (
                <div className="placeholder">
                  Generazione in corso… {Math.round((Date.now() - r.startedAt) / 1000)} s
                </div>
              )}
              {r.status === "ok" && master && (
                <>
                  <a href={r.url} target="_blank" rel="noreferrer">
                    <img className="result" src={r.url} alt={`Risultato ${i + 1}`} />
                  </a>
                  <div className="row-between">
                    <span className="muted small">Generata in {r.seconds} s</span>
                    <a className="button" href={r.url} download={downloadName(master.file.name, i)}>
                      Scarica
                    </a>
                  </div>
                </>
              )}
              {r.status === "error" && (
                <>
                  <p className="error" style={{ margin: 0 }}>{r.error}</p>
                  <div>
                    <button
                      type="button"
                      className="secondary"
                      disabled={running}
                      onClick={() => void runSlot(i)}
                    >
                      Riprova
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function UploadCard(props: {
  id: string;
  title: string;
  hint: string;
  image: SelectedImage | null;
  disabled: boolean;
  onSelect: (file: File | null) => void;
  children?: React.ReactNode;
}) {
  const { id, title, hint, image, disabled, onSelect, children } = props;
  return (
    <div className="card stack">
      <div>
        <label htmlFor={id}>{title}</label>
        <p className="muted small" style={{ margin: 0 }}>{hint}</p>
      </div>
      <input
        id={id}
        type="file"
        accept={appConfig.acceptedImageTypes.join(",")}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      {image && (
        <>
          <img className="preview" src={image.previewUrl} alt={title} />
          <p className="muted small" style={{ margin: 0, overflowWrap: "anywhere" }}>
            {image.file.name} · {formatMB(image.file.size)}
          </p>
        </>
      )}
      {children}
    </div>
  );
}
