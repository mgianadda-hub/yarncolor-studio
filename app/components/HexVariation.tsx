"use client";

import { CircleAlert, Info, SunMoon } from "lucide-react";
import { appConfig } from "@/config/app.config";
import type { VariationResult } from "@/lib/oklch";

type Props = {
  enabled: boolean;
  percentInput: string;
  percentError: string | null;
  /** null se manca un esadecimale valido o la variazione è disattivata. */
  variation: VariationResult | null;
  disabled: boolean;
  onEnabledChange: (value: boolean) => void;
  onPercentChange: (value: string) => void;
};

export function variantLabel(deltaPercent: number): string {
  if (deltaPercent === 0) return "impostato";
  const value = Math.abs(deltaPercent).toLocaleString("it-IT");
  return deltaPercent < 0 ? `−${value}%` : `+${value}%`;
}

/** Modalità "Da codice colore" con 3 immagini: variazione di luminosità in OKLCH. */
export default function HexVariation(props: Props) {
  const { enabled, percentInput, percentError, variation, disabled, onEnabledChange, onPercentChange } = props;
  const { minPercent, maxPercent } = appConfig.hexVariation;
  const chromaReduced = variation?.ok && variation.variants.some((v) => v.chromaReduced);

  return (
    <div className={`variation${enabled ? " is-active" : ""}`}>
      <div className="variation-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          <SunMoon size={16} aria-hidden="true" />
          Varia luminosità
        </label>
        <div className="percent-field">
          <input
            id="variation-percent"
            className={`input${percentError ? " is-invalid" : ""}`}
            type="number"
            inputMode="decimal"
            min={minPercent}
            max={maxPercent}
            step={0.5}
            value={percentInput}
            disabled={disabled || !enabled}
            aria-label="Percentuale di variazione della luminosità"
            aria-invalid={!!percentError}
            onChange={(e) => onPercentChange(e.target.value)}
          />
          <span aria-hidden="true">%</span>
        </div>
      </div>

      {enabled && (
        <>
          {percentError ? (
            <p className="hint-row error">{percentError}</p>
          ) : variation && !variation.ok ? (
            <div className="callout callout-error" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <div>{variation.error}</div>
            </div>
          ) : variation?.ok ? (
            <>
              <ol className="swatches" aria-label="Colori delle tre immagini">
                {variation.variants.map((v, i) => (
                  <li key={i}>
                    <span className="swatch" style={{ background: v.hex }} />
                    <span className="swatch-hex">{v.hex}</span>
                    <span className="swatch-label">
                      {i + 1} · {variantLabel(v.deltaPercent)}
                    </span>
                  </li>
                ))}
              </ol>
              {chromaReduced && (
                <p className="hint-row">
                  <Info size={14} aria-hidden="true" /> Per restare nei colori sRGB la saturazione di una variante
                  è stata ridotta leggermente; tinta e luminosità sono rispettate.
                </p>
              )}
            </>
          ) : (
            <p className="hint-row">Inserisci un codice colore per vedere le tre varianti.</p>
          )}
        </>
      )}
      {!enabled && (
        <p className="hint-row">Disattivata: le 3 immagini usano tutte l&apos;esadecimale impostato.</p>
      )}
    </div>
  );
}
