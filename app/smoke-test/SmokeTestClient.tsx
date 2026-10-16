"use client";

import { useState } from "react";
import { appConfig } from "@/config/app.config";
import { computeOutputSize, readImageDimensions, type OutputSizeResult } from "@/lib/output-size";
import { formatMB, validateUploads } from "@/lib/upload";

type Row = {
  model: string;
  status: "pending" | "ok" | "error";
  requestedSize?: string;
  outputSize?: string;
  openaiMs?: number;
  totalMs?: number;
  bytes?: number;
  url?: string;
  error?: string;
};

type MasterInfo = { width: number; height: number; output: OutputSizeResult };

export default function SmokeTestClient({ defaultPrompt }: { defaultPrompt: string }) {
  const [master, setMaster] = useState<File | null>(null);
  const [destination, setDestination] = useState<File | null>(null);
  const [masterInfo, setMasterInfo] = useState<MasterInfo | null>(null);
  const [models, setModels] = useState<string[]>(appConfig.models.map((m) => m.id));
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  async function onMasterChange(file: File | null) {
    setMaster(file);
    setMasterInfo(null);
    if (!file) return;
    try {
      const dims = readImageDimensions(new Uint8Array(await file.arrayBuffer()));
      setMasterInfo({ ...dims, output: computeOutputSize(dims) });
    } catch (e) {
      setMasterInfo({
        width: 0,
        height: 0,
        output: { ok: false, error: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  const uploadError = master && destination ? validateUploads(master, destination) : null;
  const canRun =
    !!master && !!destination && !uploadError && masterInfo?.output.ok && models.length > 0;

  async function runOne(model: string) {
    const started = performance.now();
    const form = new FormData();
    form.append("master", master!);
    form.append("destination", destination!);
    form.append("prompt", defaultPrompt);
    form.append("model", model);
    let patch: Partial<Row>;
    try {
      const response = await fetch("/api/smoke-test", { method: "POST", body: form });
      const totalMs = Math.round(performance.now() - started);
      if (response.ok) {
        const blob = await response.blob();
        patch = {
          status: "ok",
          requestedSize: response.headers.get("X-Requested-Size") ?? undefined,
          outputSize: response.headers.get("X-Output-Size") ?? undefined,
          openaiMs: Number(response.headers.get("X-Duration-Ms")),
          totalMs,
          bytes: blob.size,
          url: URL.createObjectURL(blob),
        };
      } else {
        const text = await response.text();
        let message = `HTTP ${response.status}`;
        try {
          message = (JSON.parse(text) as { error?: string }).error ?? message;
        } catch {
          if (text) message += `: ${text.slice(0, 300)}`;
        }
        patch = { status: "error", totalMs, error: message };
      }
    } catch (e) {
      patch = { status: "error", error: e instanceof Error ? e.message : String(e) };
    }
    setRows((prev) => prev.map((r) => (r.model === model ? { ...r, ...patch } : r)));
  }

  async function run() {
    setRunning(true);
    setRows(models.map((model) => ({ model, status: "pending" })));
    await Promise.all(models.map(runOne));
    setRunning(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <div>
          <label htmlFor="master">1. Master</label>
          <br />
          <input
            id="master"
            type="file"
            accept={appConfig.acceptedImageTypes.join(",")}
            onChange={(e) => onMasterChange(e.target.files?.[0] ?? null)}
          />
          {masterInfo && (
            <p style={{ margin: "4px 0 0" }}>
              {masterInfo.width > 0 && `Master ${masterInfo.width}×${masterInfo.height} · `}
              {masterInfo.output.ok ? (
                <strong>Verrà generata a {masterInfo.output.width}×{masterInfo.output.height}</strong>
              ) : (
                <span className="error">{masterInfo.output.error}</span>
              )}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="destination">2. Destinazione</label>
          <br />
          <input
            id="destination"
            type="file"
            accept={appConfig.acceptedImageTypes.join(",")}
            onChange={(e) => setDestination(e.target.files?.[0] ?? null)}
          />
        </div>
        {master && destination && (
          <p className="muted" style={{ margin: 0 }}>
            Peso totale input: {formatMB(master.size + destination.size)} (massimo{" "}
            {formatMB(appConfig.maxUploadTotalBytes)})
          </p>
        )}
        {uploadError && <p className="error" style={{ margin: 0 }}>{uploadError}</p>}
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600 }}>Modelli da testare</legend>
          {appConfig.models.map((m) => (
            <label key={m.id} style={{ display: "block", fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={models.includes(m.id)}
                onChange={(e) =>
                  setModels((prev) =>
                    e.target.checked
                      ? appConfig.models.map((x) => x.id).filter((id) => id === m.id || prev.includes(id))
                      : prev.filter((id) => id !== m.id),
                  )
                }
              />{" "}
              {m.id} {m.note && <span className="muted">({m.note})</span>}
            </label>
          ))}
        </fieldset>
        <p className="muted" style={{ margin: 0 }}>
          Parametri: quality {appConfig.quality}, output {appConfig.outputFormat} (compressione{" "}
          {appConfig.outputCompression}), n=1, prompt di default ({defaultPrompt.length} caratteri).
        </p>
        <div>
          <button onClick={run} disabled={!canRun || running}>
            {running ? "Test in corso…" : "Esegui test"}
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Modello</th>
                <th>Esito</th>
                <th>Size richiesta</th>
                <th>Size ottenuta</th>
                <th>Tempo OpenAI</th>
                <th>Tempo totale</th>
                <th>Peso JPEG</th>
                <th>Risultato</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model}>
                  <td>{r.model}</td>
                  <td className={r.status === "error" ? "error" : undefined}>
                    {r.status === "pending" ? "in corso…" : r.status === "ok" ? "OK" : r.error}
                  </td>
                  <td>{r.requestedSize ?? "—"}</td>
                  <td>{r.outputSize ?? "—"}</td>
                  <td>{r.openaiMs ? `${(r.openaiMs / 1000).toFixed(1)} s` : "—"}</td>
                  <td>{r.totalMs ? `${(r.totalMs / 1000).toFixed(1)} s` : "—"}</td>
                  <td>{r.bytes ? formatMB(r.bytes) : "—"}</td>
                  <td>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        <img className="preview" src={r.url} alt={`Risultato ${r.model}`} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
