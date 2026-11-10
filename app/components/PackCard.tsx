"use client";

import { useRef, useState } from "react";
import { ImageIcon, Upload, Wand2, X } from "lucide-react";
import { appConfig } from "@/config/app.config";
import { formatMB } from "@/lib/upload";
import type { SelectedImage } from "./UploadCard";

type Props = {
  images: (SelectedImage | null)[];
  disabled: boolean;
  onSelect: (index: number, file: File | null) => void;
};

/** Scheda "Multipack": tre spazi fissi per i master (Pack 2, 5, 10 pz), ognuno facoltativo. */
export default function PackCard({ images, disabled, onSelect }: Props) {
  return (
    <section className="card pack-card">
      <header className="card-header">
        <span className="step">1</span>
        <div>
          <h2>Immagini master</h2>
          <p>Carica almeno un pack: ogni master produce un&apos;immagine.</p>
        </div>
      </header>
      <div className="pack-grid">
        {appConfig.packs.map((pack, i) => (
          <PackSlot
            key={pack.tag}
            index={i}
            label={pack.label}
            image={images[i] ?? null}
            disabled={disabled}
            onSelect={(file) => onSelect(i, file)}
          />
        ))}
      </div>
    </section>
  );
}

function PackSlot(props: {
  index: number;
  label: string;
  image: SelectedImage | null;
  disabled: boolean;
  onSelect: (file: File | null) => void;
}) {
  const { index, label, image, disabled, onSelect } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = `pack-${index}`;

  return (
    <div
      className={`pack-slot${dragging ? " is-dragging" : ""}${image ? " has-image" : ""}`}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (!disabled && file) onSelect(file);
      }}
    >
      <div className="pack-slot-header">
        <span className="pack-label">{label}</span>
        {image && (
          <button
            type="button"
            className="icon-btn icon-btn-sm"
            disabled={disabled}
            onClick={() => onSelect(null)}
            aria-label={`Rimuovi il master di ${label}`}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <button
        type="button"
        className="preview-box"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label={image ? `Sostituisci il master di ${label}` : `Carica il master di ${label}`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.previewUrl} alt="" />
        ) : (
          <span className="preview-empty">
            <ImageIcon size={32} strokeWidth={1.5} aria-hidden="true" />
            Facoltativo
          </span>
        )}
      </button>

      <label htmlFor={inputId} className={`dropzone dropzone-sm${disabled ? " is-disabled" : ""}`}>
        <span className="dropzone-title">
          <Upload size={16} aria-hidden="true" /> {image ? "Sostituisci" : "Scegli file"}
        </span>
        <span className="dropzone-hint">o trascina un&apos;immagine qui</span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="visually-hidden"
        accept={appConfig.acceptedImageTypes.join(",")}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />

      {image && (
        <div className="pack-meta">
          <span className="meta-value break">{image.file.name}</span>
          <span className="meta-label">
            {formatMB(image.file.size)}
            {image.width ? ` · ${image.width} × ${image.height}` : ""}
          </span>
          {image.output &&
            (image.output.ok ? (
              <span className="pack-output">
                <Wand2 size={15} aria-hidden="true" /> Verrà generata a{" "}
                <strong>
                  {image.output.width} × {image.output.height}
                </strong>
              </span>
            ) : (
              <span className="error small" role="alert">
                {image.output.error}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
