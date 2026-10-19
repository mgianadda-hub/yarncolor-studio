"use client";

import { Images, Palette } from "lucide-react";

export type Mode = "sample" | "hex";

const MODES: { id: Mode; label: string; hint: string; Icon: typeof Images }[] = [
  { id: "sample", label: "Da campione", hint: "Master + foto del filato", Icon: Images },
  { id: "hex", label: "Da codice colore", hint: "Master + codice esadecimale", Icon: Palette },
];

/** Selettore della modalità di ricolorazione. */
export default function ModeSwitch({
  mode,
  disabled,
  onChange,
}: {
  mode: Mode;
  disabled: boolean;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div className="mode-switch" role="radiogroup" aria-label="Modalità di ricolorazione">
      {MODES.map(({ id, label, hint, Icon }) => (
        <label key={id} className={`mode-option${mode === id ? " is-active" : ""}`}>
          <input
            type="radio"
            name="mode"
            value={id}
            checked={mode === id}
            disabled={disabled}
            onChange={() => onChange(id)}
          />
          <span className="mode-icon">
            <Icon size={20} aria-hidden="true" />
          </span>
          <span className="mode-text">
            <strong>{label}</strong>
            <span>{hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
