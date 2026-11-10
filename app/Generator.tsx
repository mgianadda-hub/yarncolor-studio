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
  Tag,
} from "lucide-react";
import { appConfig } from "@/config/app.config";
import { hexDownloadName, packDownloadName, sampleDownloadName } from "@/lib/filenames";
import { TARGET_HEX_PLACEHOLDER, normalizeHex } from "@/lib/hex";
import { lightnessVariants } from "@/lib/oklch";
import { computeOutputSize, readImageDimensions } from "@/lib/output-size";
import { formatMB, validateUploads } from "@/lib/upload";
import ColorCard from "./components/ColorCard";
import HexVariation, { variantLabel } from "./components/HexVariation";
import ModeSwitch, { type Mode } from "./components/ModeSwitch";
import PackCard from "./components/PackCard";
import ResultsSection, { type Result } from "./components/ResultsSection";
import UploadCard, { type SelectedImage } from "./components/UploadCard";

/** Input dell'ultima generazione: usati da "Riprova" e per i nomi dei file scaricati. */
type Job = {
  mode: Mode;
  master: File;
  destination?: File;
  /**
   * Solo modalità "Da codice colore": esadecimale usato da ciascuna immagine (diversi con la variazione
   * di luminosità), etichetta della variante e nome colore (quest'ultimo solo per il nome file).
   */
  hexes?: string[];
  hexLabels?: string[];
  variation?: boolean;
  colorName?: string;
  /**
   * Solo scheda "Multipack": per ogni chiamata il proprio master, la size calcolata su quel master,
   * il tag del pack (per il nome file) e la posizione dello spazio di caricamento (0, 1, 2).
   */
  slotMasters?: File[];
  slotSizes?: (string | undefined)[];
  packTags?: string[];
  packSlots?: number[];
  prompt: string;
  model: string;
  size?: string;
};

async function generateOne(job: Job, index: number): Promise<{ blob: Blob; size: string }> {
  const form = new FormData();
  form.append("mode", job.mode);
  form.append("master", job.slotMasters?.[index] ?? job.master);
  if ((job.mode === "sample" || job.mode === "pack") && job.destination) {
    form.append("destination", job.destination);
  }
  // Il nome colore non viene mai inviato: serve solo per il nome del file.
  const hex = job.hexes?.[index];
  if (job.mode === "hex" && hex) form.append("hex", hex);
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
  if (job.mode === "pack") {
    return packDownloadName(
      job.slotMasters?.[index]?.name ?? job.master.name,
      job.packTags?.[index] ?? "",
      job.colorName ?? "",
    );
  }
  return job.mode === "hex"
    ? hexDownloadName(
        job.master.name,
        job.hexes?.[index] ?? "",
        job.colorName ?? "",
        index,
        total,
        !!job.variation,
      )
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
  // Variazione di luminosità (solo "Da codice colore" con 3 immagini).
  const [variationOn, setVariationOn] = useState(false);
  const [percentInput, setPercentInput] = useState(String(appConfig.hexVariation.defaultPercent));
  // Scheda "Multipack": stato separato dalle altre schede.
  const [packMasters, setPackMasters] = useState<(SelectedImage | null)[]>(() =>
    appConfig.packs.map(() => null),
  );
  const [packDestination, setPackDestination] = useState<SelectedImage | null>(null);
  const [packColorName, setPackColorName] = useState("");
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

  /** Anteprima e, per i master, dimensioni e size di output (senza modificare l'immagine). */
  async function prepareImage(file: File, isMaster: boolean): Promise<SelectedImage> {
    const accepted: readonly string[] = appConfig.acceptedImageTypes;
    const selected: SelectedImage = { file, previewUrl: URL.createObjectURL(file) };
    if (isMaster) {
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
    return selected;
  }

  async function selectImage(file: File | null, kind: "master" | "destination") {
    const setter = kind === "master" ? setMaster : setDestination;
    setter((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (!file) return;
    setter(await prepareImage(file, kind === "master"));
  }

  async function selectPackMaster(index: number, file: File | null) {
    const update = (value: SelectedImage | null) =>
      setPackMasters((prev) =>
        prev.map((img, i) => {
          if (i !== index) return img;
          if (img) URL.revokeObjectURL(img.previewUrl);
          return value;
        }),
      );
    update(null);
    if (file) update(await prepareImage(file, true));
  }

  async function selectPackDestination(file: File | null) {
    setPackDestination((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    if (file) setPackDestination(await prepareImage(file, false));
  }

  const isHex = mode === "hex";
  const hex = normalizeHex(hexInput);
  const missingPlaceholder = isHex && !prompt.includes(TARGET_HEX_PLACEHOLDER);

  // Variazione di luminosità: disponibile solo in "Da codice colore" con più immagini.
  const variationAvailable = isHex && count === 3;
  const variationActive = variationAvailable && variationOn;
  const { minPercent, maxPercent } = appConfig.hexVariation;
  const percent = Number(percentInput.replace(",", "."));
  const percentError =
    percentInput.trim() === "" || !Number.isFinite(percent) || percent < minPercent || percent > maxPercent
      ? `Inserisci una percentuale tra ${minPercent.toLocaleString("it-IT")} e ${maxPercent}.`
      : null;
  const variation = variationActive && hex && !percentError ? lightnessVariants(hex, percent) : null;
  /** Esadecimale e etichetta di ciascuna immagine. */
  const slotColors: { hex: string; label: string }[] | null = !hex
    ? null
    : variationActive && variation?.ok
      ? variation.variants.map((v) => ({ hex: v.hex, label: variantLabel(v.deltaPercent) }))
      : Array.from({ length: count }, () => ({ hex, label: "impostato" }));
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
            : variationActive && percentError
              ? "Percentuale di variazione non valida."
              : variationActive && variation && !variation.ok
                ? "La variazione di luminosità non è applicabile a questo colore."
                : null;

  const canGenerate = !missing && !uploadError && master?.output?.ok === true && !running;
  const inputBytes = (master?.file.size ?? 0) + (!isHex ? (destination?.file.size ?? 0) : 0);

  // Scheda "Multipack": una chiamata per ogni master caricato, ciascuna con la destinazione.
  const isPack = mode === "pack";
  const activePacks = appConfig.packs
    .map((pack, slot) => ({ ...pack, slot, image: packMasters[slot] }))
    .filter((p): p is typeof p & { image: SelectedImage } => p.image !== null);
  const packUploadError = packDestination
    ? (activePacks
        .map((p) => {
          const error = validateUploads(p.image.file, packDestination.file);
          return error ? `${p.label}: ${error}` : null;
        })
        .find(Boolean) ?? null)
    : null;
  const packInvalidMaster = activePacks.find((p) => p.image.output?.ok !== true);
  const packMissing =
    activePacks.length === 0
      ? "Carica almeno un'immagine master (Pack 2, 5 o 10 pz)."
      : !packDestination
        ? "Carica l'immagine con il colore destinazione."
        : packInvalidMaster
          ? `${packInvalidMaster.label}: il master non può essere usato.`
          : !prompt.trim()
            ? "Il prompt è vuoto."
            : null;
  const canGeneratePack = isPack && !packMissing && !packUploadError && !running;
  const packInputBytes = Math.max(
    0,
    ...activePacks.map((p) => p.image.file.size + (packDestination?.file.size ?? 0)),
  );
  const packFileNames = activePacks.map((p) => packDownloadName(p.image.file.name, p.tag, packColorName));

  function setResult(index: number, result: Result) {
    setResults((prev) => prev.map((r, i) => (i === index ? result : r)));
  }

  async function runSlot(index: number, current: Job) {
    const { model } = current;
    const size = current.slotSizes ? current.slotSizes[index] : current.size;
    const hex = current.hexes?.[index];
    const hexLabel = current.variation ? current.hexLabels?.[index] : undefined;
    const startedAt = Date.now();
    setResult(index, { status: "pending", startedAt, model, size, hex, hexLabel });
    try {
      const { blob, size: outputSize } = await generateOne(current, index);
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
        hexLabel,
        finishedAt,
      });
    } catch (e) {
      setResult(index, {
        status: "error",
        error: e instanceof Error ? e.message : "Errore sconosciuto.",
        model,
        hex,
        hexLabel,
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
      hexes: isHex ? slotColors?.map((c) => c.hex) : undefined,
      hexLabels: isHex ? slotColors?.map((c) => c.label) : undefined,
      variation: isHex && variationActive,
      colorName: isHex ? colorName : undefined,
      prompt,
      model,
      size: master.output?.ok ? master.output.size : undefined,
    };
    setJob(current);
    if (isHex && hex) setHexInput(hex);
    const startedAt = Date.now();
    setResults(
      Array.from({ length: count }, (_, i) => ({
        status: "pending",
        startedAt,
        model,
        size: current.size,
        hex: current.hexes?.[i],
        hexLabel: current.variation ? current.hexLabels?.[i] : undefined,
      })),
    );
    // Una chiamata per immagine, in parallelo: ognuna parte dal master.
    for (let i = 0; i < count; i++) void runSlot(i, current);
  }

  function generatePack() {
    if (!canGeneratePack || !packDestination) return;
    resultUrls.current.forEach((url) => URL.revokeObjectURL(url));
    resultUrls.current = [];
    const current: Job = {
      mode: "pack",
      master: activePacks[0].image.file,
      destination: packDestination.file,
      slotMasters: activePacks.map((p) => p.image.file),
      slotSizes: activePacks.map((p) => (p.image.output?.ok ? p.image.output.size : undefined)),
      packTags: activePacks.map((p) => p.tag),
      packSlots: activePacks.map((p) => p.slot),
      colorName: packColorName,
      prompt,
      model,
    };
    setJob(current);
    const startedAt = Date.now();
    setResults(
      activePacks.map((_, i) => ({ status: "pending", startedAt, model, size: current.slotSizes?.[i] })),
    );
    // Una chiamata per ogni master caricato, in parallelo: [master del pack, colore destinazione].
    activePacks.forEach((_, i) => void runSlot(i, current));
  }

  /** Pulsante Genera e messaggi: valori della scheda attiva (Multipack o le altre due). */
  const gen = isPack
    ? {
        enabled: canGeneratePack,
        count: activePacks.length,
        uploadError: packUploadError,
        missing: packMissing,
        hintIsError: !!packUploadError,
        bytes: packInputBytes,
      }
    : {
        enabled: canGenerate,
        count,
        uploadError,
        missing,
        hintIsError: !!(uploadError || missingPlaceholder),
        bytes: inputBytes,
      };

  const fileNameExamples =
    isHex && slotColors && !(variationActive && !variation?.ok)
      ? slotColors.map((c, i) =>
          hexDownloadName(master?.file.name || "master", c.hex, colorName, i, count, variationActive),
        )
      : null;

  return (
    <div className="stack-lg">
      <ModeSwitch mode={mode} disabled={running} onChange={setMode} />

      {isPack ? (
        <div className="inputs-grid is-pack">
          <PackCard images={packMasters} disabled={running} onSelect={selectPackMaster} />
          <UploadCard
            step={2}
            title="Colore destinazione"
            hint="Il dettaglio del filato con il colore da applicare a tutti i pack."
            image={packDestination}
            disabled={running}
            onSelect={selectPackDestination}
          >
            <div className="field">
              <label htmlFor="pack-color-name" className="field-label">
                <Tag size={16} aria-hidden="true" /> Nome colore <span className="optional">(facoltativo)</span>
              </label>
              <input
                id="pack-color-name"
                className="input"
                placeholder="es. blu navy"
                value={packColorName}
                maxLength={60}
                autoComplete="off"
                disabled={running}
                onChange={(e) => setPackColorName(e.target.value)}
              />
              <p className="hint-row">Serve solo per il nome dei file, non viene inviato al modello.</p>
              {packFileNames.length > 0 && (
                <ul className="file-examples" aria-label="Nomi dei file">
                  {packFileNames.map((name) => (
                    <li key={name} className="mono break">
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </UploadCard>
        </div>
      ) : (
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
            fileNameExamples={fileNameExamples}
            variants={variationActive && variation?.ok ? variation.variants : null}
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
      )}

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
            {isHex ? " (Da codice colore)" : isPack ? " (Multipack)" : " (Da campione)"} · {prompt.length.toLocaleString("it-IT")}{" "}
            caratteri
            {isHex && !missingPlaceholder && (
              <>
                {" "}
                · <code>{TARGET_HEX_PLACEHOLDER}</code> sarà sostituito con{" "}
                {variationActive && variation?.ok
                  ? "l'esadecimale di ciascuna immagine"
                  : (hex ?? "il codice colore")}
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

          {isPack ? (
            <div className="field">
              <span className="field-label">
                <ImageIcon size={16} aria-hidden="true" /> Numero di immagini
              </span>
              <p className="pack-count">
                Una per ogni pack caricato: <strong>{activePacks.length}</strong>
              </p>
            </div>
          ) : (
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
          )}

          {variationAvailable && (
            <HexVariation
              enabled={variationOn}
              percentInput={percentInput}
              percentError={percentError}
              variation={variation}
              disabled={running}
              onEnabledChange={setVariationOn}
              onPercentChange={setPercentInput}
            />
          )}

          <div className="generate-area">
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={isPack ? generatePack : generate}
              disabled={!gen.enabled}
            >
              {running ? (
                <>
                  <LoaderCircle size={20} className="spin" aria-hidden="true" /> Generazione in corso…
                </>
              ) : (
                <>
                  <Sparkles size={20} aria-hidden="true" />
                  {gen.count === 1
                    ? "Genera immagine"
                    : gen.count > 1
                      ? `Genera ${gen.count} immagini`
                      : "Genera immagini"}
                  <ChevronRight size={20} aria-hidden="true" />
                </>
              )}
            </button>
            {!running && (gen.uploadError || gen.missing) && (
              <p className={`hint-row center${gen.hintIsError ? " error" : ""}`}>
                {gen.uploadError ?? gen.missing}
              </p>
            )}
            {!running && !gen.uploadError && !gen.missing && (
              <p className="hint-row center">
                {isPack ? "Input per chiamata" : "Input"}: {formatMB(gen.bytes)} su{" "}
                {formatMB(appConfig.maxUploadTotalBytes)}
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
        tiles={
          job?.mode === "pack"
            ? appConfig.packs.map((pack, slot) => {
                const index = job.packSlots?.indexOf(slot) ?? -1;
                return { label: pack.label, resultIndex: index >= 0 ? index : null };
              })
            : undefined
        }
      />
    </div>
  );
}
