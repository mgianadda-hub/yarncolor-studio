"use client";

import { useState } from "react";
import {
  CircleAlert,
  Clock,
  Cpu,
  Download,
  File as FileIcon,
  Images,
  LoaderCircle,
  Palette,
  RefreshCw,
  Scan,
  ZoomIn,
} from "lucide-react";
import { formatMB } from "@/lib/upload";
import Lightbox from "./Lightbox";

/**
 * `hex` (esadecimale usato) è presente solo nella modalità "Da codice colore"; `hexLabel` solo con la
 * variazione di luminosità (es. "−5%", "impostato", "+5%").
 */
type HexInfo = { hex?: string; hexLabel?: string };

export type Result = HexInfo &
  (
    | { status: "pending"; startedAt: number; model: string; size?: string }
    | {
        status: "ok";
        url: string;
        seconds: number;
        bytes: number;
        size: string;
        model: string;
        finishedAt: number;
      }
    | { status: "error"; error: string; model: string }
  );

function HexTag({ result }: { result: HexInfo }) {
  if (!result.hex) return null;
  return (
    <span className="hex-tag">
      <span className="swatch-dot" style={{ background: result.hex }} aria-hidden="true" />
      <span className="mono">{result.hex}</span>
      {result.hexLabel && <span className="hex-tag-label">{result.hexLabel}</span>}
    </span>
  );
}

type Props = {
  results: Result[];
  canRetry: boolean;
  fileName: (index: number) => string;
  onRetry: (index: number) => void;
};

function formatSize(size: string) {
  return size.replace("x", " × ");
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsed(startedAt: number) {
  return Math.max(0, Math.round((Date.now() - startedAt) / 1000));
}

export default function ResultsSection({ results, canRetry, fileName, onRetry }: Props) {
  const [zoomed, setZoomed] = useState<number | null>(null);
  const single = results.length === 1;
  const zoomedResult = zoomed !== null ? results[zoomed] : null;

  const done = results.filter((r) => r.status === "ok");
  const pending = results.filter((r) => r.status === "pending").length;

  return (
    <section className="card results-card" aria-live="polite">
      <header className="card-header">
        <span className="icon-badge">
          <Images size={20} aria-hidden="true" />
        </span>
        <div>
          <h2>Risultato</h2>
          <p>
            {single
              ? "Immagine generata con il colore applicato al gomitolo."
              : "Immagini generate con il colore applicato al gomitolo."}
          </p>
        </div>
        {single && results[0].status === "ok" && (
          <span className="status-pill">
            <span className="dot" /> Generata in {results[0].seconds}{" "}
            {results[0].seconds === 1 ? "secondo" : "secondi"}
          </span>
        )}
        {!single && results.length > 0 && (
          <span className="status-pill">
            {pending > 0 ? (
              <>
                <LoaderCircle size={14} className="spin" aria-hidden="true" /> {done.length} di{" "}
                {results.length} pronte
              </>
            ) : (
              <>
                <span className="dot" /> {done.length} di {results.length} pronte
              </>
            )}
          </span>
        )}
      </header>

      {results.length === 0 && (
        <div className="results-empty">
          <Images size={40} strokeWidth={1.3} aria-hidden="true" />
          <p>Carica master e destinazione, poi premi «Genera»: i risultati compariranno qui.</p>
        </div>
      )}

      {single && results[0] && (
        <SingleResult
          result={results[0]}
          fileName={fileName(0)}
          canRetry={canRetry}
          onRetry={() => onRetry(0)}
          onZoom={() => setZoomed(0)}
        />
      )}

      {!single && results.length > 0 && (
        <div className="results-grid">
          {results.map((r, i) => (
            <article key={i} className="result-tile">
              <header>
                <h3>Immagine {i + 1}</h3>
                {r.status === "ok" && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => setZoomed(i)}
                    aria-label={`Ingrandisci immagine ${i + 1}`}
                  >
                    <ZoomIn size={18} />
                  </button>
                )}
              </header>
              <ResultImage result={r} onZoom={() => setZoomed(i)} compact />
              <HexTag result={r} />
              <footer>
                {r.status === "ok" && (
                  <>
                    <span className="muted-row">
                      <Clock size={16} aria-hidden="true" /> Generata in {r.seconds} s
                    </span>
                    <a className="btn btn-primary btn-sm" href={r.url} download={fileName(i)}>
                      <Download size={16} aria-hidden="true" /> Scarica
                    </a>
                  </>
                )}
                {r.status === "pending" && (
                  <span className="muted-row">
                    <Clock size={16} aria-hidden="true" /> {elapsed(r.startedAt)} s
                  </span>
                )}
                {r.status === "error" && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    disabled={!canRetry}
                    onClick={() => onRetry(i)}
                  >
                    <RefreshCw size={16} aria-hidden="true" /> Riprova
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {zoomedResult?.status === "ok" && zoomed !== null && (
        <Lightbox
          url={zoomedResult.url}
          title={
            (results.length > 1 ? `Immagine ${zoomed + 1}` : "Immagine generata") +
            (zoomedResult.hex ? ` · ${zoomedResult.hex}` : "")
          }
          downloadName={fileName(zoomed)}
          onClose={() => setZoomed(null)}
        />
      )}
    </section>
  );
}

function ResultImage({
  result,
  onZoom,
  compact,
}: {
  result: Result;
  onZoom: () => void;
  compact?: boolean;
}) {
  if (result.status === "ok") {
    return (
      <button type="button" className={`result-image${compact ? " compact" : ""}`} onClick={onZoom}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.url} alt="Immagine generata" />
      </button>
    );
  }
  if (result.status === "pending") {
    return (
      <div className={`result-image placeholder${compact ? " compact" : ""}`}>
        <LoaderCircle size={34} className="spin" aria-hidden="true" />
        <span>Generazione in corso…</span>
        <span className="small">{elapsed(result.startedAt)} s</span>
      </div>
    );
  }
  return (
    <div className={`result-image placeholder is-error${compact ? " compact" : ""}`} role="alert">
      <CircleAlert size={30} aria-hidden="true" />
      <span>{result.error}</span>
    </div>
  );
}

function SingleResult({
  result,
  fileName,
  canRetry,
  onRetry,
  onZoom,
}: {
  result: Result;
  fileName: string;
  canRetry: boolean;
  onRetry: () => void;
  onZoom: () => void;
}) {
  return (
    <div className="single-result">
      <div className="single-image">
        {result.status === "ok" && (
          <button type="button" className="icon-btn floating" onClick={onZoom} aria-label="Ingrandisci">
            <ZoomIn size={18} />
          </button>
        )}
        <ResultImage result={result} onZoom={onZoom} />
      </div>

      <aside className="details">
        <h3>Dettagli immagine</h3>
        <dl>
          <div>
            <dt>
              <Scan size={16} aria-hidden="true" /> Dimensioni
            </dt>
            <dd>
              {result.status === "ok"
                ? formatSize(result.size)
                : result.status === "pending" && result.size
                  ? formatSize(result.size)
                  : "—"}
            </dd>
          </div>
          <div>
            <dt>
              <FileIcon size={16} aria-hidden="true" /> Dimensione file
            </dt>
            <dd>{result.status === "ok" ? formatMB(result.bytes) : "—"}</dd>
          </div>
          <div>
            <dt>
              <Cpu size={16} aria-hidden="true" /> Modello
            </dt>
            <dd>{result.model}</dd>
          </div>
          {result.hex && (
            <div>
              <dt>
                <Palette size={16} aria-hidden="true" /> Colore
              </dt>
              <dd className="color-dd">
                <span className="swatch-dot" style={{ background: result.hex }} aria-hidden="true" />
                {result.hex}
                {result.hexLabel && ` (${result.hexLabel})`}
              </dd>
            </div>
          )}
          <div>
            <dt>
              <Clock size={16} aria-hidden="true" /> Generata il
            </dt>
            <dd>{result.status === "ok" ? formatDate(result.finishedAt) : "—"}</dd>
          </div>
        </dl>
        {result.status === "ok" && (
          <a className="btn btn-soft btn-block" href={result.url} download={fileName}>
            <Download size={18} aria-hidden="true" /> Scarica immagine
          </a>
        )}
        {result.status === "error" && (
          <button type="button" className="btn btn-outline btn-block" disabled={!canRetry} onClick={onRetry}>
            <RefreshCw size={18} aria-hidden="true" /> Riprova
          </button>
        )}
      </aside>
    </div>
  );
}
