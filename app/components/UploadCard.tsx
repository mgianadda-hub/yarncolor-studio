"use client";

import { useRef, useState } from "react";
import { File as FileIcon, ImageIcon, Scan, Upload, Wand2 } from "lucide-react";
import { appConfig } from "@/config/app.config";
import type { OutputSizeResult } from "@/lib/output-size";
import { formatMB } from "@/lib/upload";

export type SelectedImage = {
  file: File;
  previewUrl: string;
  width?: number;
  height?: number;
  output?: OutputSizeResult;
};

type Props = {
  step: number;
  title: string;
  hint: string;
  image: SelectedImage | null;
  disabled: boolean;
  showSizes?: boolean;
  onSelect: (file: File | null) => void;
};

export default function UploadCard({ step, title, hint, image, disabled, showSizes, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = `upload-${step}`;

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onSelect(file);
  }

  return (
    <section
      className={`card upload-card${dragging ? " is-dragging" : ""}`}
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
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
    >
      <header className="card-header">
        <span className="step">{step}</span>
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
      </header>

      <div className="upload-body">
        <button
          type="button"
          className="preview-box"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          aria-label={image ? `Sostituisci ${title.toLowerCase()}` : `Carica ${title.toLowerCase()}`}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.previewUrl} alt="" />
          ) : (
            <span className="preview-empty">
              <ImageIcon size={36} strokeWidth={1.5} aria-hidden="true" />
              Nessuna immagine
            </span>
          )}
        </button>

        <div className="upload-side">
          <label htmlFor={inputId} className={`dropzone${disabled ? " is-disabled" : ""}`}>
            <span className="dropzone-title">
              <Upload size={18} aria-hidden="true" /> Scegli file
            </span>
            <span className="dropzone-hint">
              o trascina un&apos;immagine qui <ImageIcon size={15} aria-hidden="true" />
            </span>
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="visually-hidden"
            accept={appConfig.acceptedImageTypes.join(",")}
            disabled={disabled}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {image && (
            <ul className="meta-list">
              <li>
                <FileIcon size={20} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <span className="meta-value break">{image.file.name}</span>
                  <span className="meta-label">{formatMB(image.file.size)}</span>
                </div>
              </li>
              {showSizes && image.width && (
                <li>
                  <Scan size={20} strokeWidth={1.6} aria-hidden="true" />
                  <div>
                    <span className="meta-value">Dimensioni master</span>
                    <span className="meta-label">
                      {image.width} × {image.height}
                    </span>
                  </div>
                </li>
              )}
            </ul>
          )}

          {showSizes && image?.output && (
            image.output.ok ? (
              <div className="callout">
                <Wand2 size={20} aria-hidden="true" />
                <div>
                  L&apos;immagine generata avrà dimensioni
                  <strong>
                    {image.output.width} × {image.output.height}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="callout callout-error" role="alert">
                {image.output.error}
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
