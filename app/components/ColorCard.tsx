"use client";

import { Hash, Palette, Tag } from "lucide-react";
import { normalizeHex } from "@/lib/hex";

type Props = {
  step: number;
  hexInput: string;
  colorName: string;
  disabled: boolean;
  /** Esempio del nome file risultante, mostrato sotto il nome colore. */
  fileNameExample: string | null;
  onHexChange: (value: string) => void;
  onColorNameChange: (value: string) => void;
};

/** Modalità "Da codice colore": esadecimale obbligatorio con color picker e anteprima, nome colore facoltativo. */
export default function ColorCard(props: Props) {
  const { step, hexInput, colorName, disabled, fileNameExample, onHexChange, onColorNameChange } = props;
  const hex = normalizeHex(hexInput);
  const invalid = hexInput.trim() !== "" && !hex;

  return (
    <section className="card upload-card">
      <header className="card-header">
        <span className="step">{step}</span>
        <div>
          <h2>Colore di destinazione</h2>
          <p>Il codice esadecimale del colore da applicare al filato.</p>
        </div>
      </header>

      <div className="upload-body">
        <div
          className={`preview-box color-preview${hex ? " has-color" : ""}`}
          style={hex ? { background: hex } : undefined}
          aria-hidden="true"
        >
          {hex ? (
            <span className="color-chip">{hex}</span>
          ) : (
            <span className="preview-empty">
              <Palette size={36} strokeWidth={1.5} />
              Nessun colore
            </span>
          )}
        </div>

        <div className="upload-side">
          <div className="field">
            <label htmlFor="hex" className="field-label">
              <Hash size={16} aria-hidden="true" /> Codice esadecimale <span className="required">*</span>
            </label>
            <div className="hex-row">
              <input
                id="hex"
                className={`input mono${invalid ? " is-invalid" : ""}`}
                placeholder="#1A2B3C"
                value={hexInput}
                maxLength={9}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                aria-invalid={invalid}
                aria-describedby="hex-hint"
                onChange={(e) => onHexChange(e.target.value)}
                onBlur={() => hex && onHexChange(hex)}
              />
              <label className={`picker${disabled ? " is-disabled" : ""}`} title="Scegli dal selettore colori">
                <input
                  type="color"
                  value={(hex ?? "#8A4A2B").toLowerCase()}
                  disabled={disabled}
                  aria-label="Selettore colori"
                  onChange={(e) => onHexChange(e.target.value.toUpperCase())}
                />
                <span className="picker-swatch" style={{ background: hex ?? "transparent" }} />
              </label>
            </div>
            <p id="hex-hint" className={`hint-row${invalid ? " error" : ""}`}>
              {invalid
                ? "Codice non valido: servono 6 cifre esadecimali (0-9, A-F), con o senza #."
                : hex
                  ? `Verrà usato ${hex}.`
                  : "6 cifre, con o senza #. Es. 1A2B3C o #1A2B3C."}
            </p>
          </div>

          <div className="field">
            <label htmlFor="color-name" className="field-label">
              <Tag size={16} aria-hidden="true" /> Nome colore <span className="optional">(facoltativo)</span>
            </label>
            <input
              id="color-name"
              className="input"
              placeholder="es. blu navy"
              value={colorName}
              maxLength={60}
              autoComplete="off"
              disabled={disabled}
              onChange={(e) => onColorNameChange(e.target.value)}
            />
            <p className="hint-row">
              Serve solo per il nome del file, non viene inviato al modello.
              {fileNameExample && (
                <>
                  {" "}
                  File: <span className="mono break">{fileNameExample}</span>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
