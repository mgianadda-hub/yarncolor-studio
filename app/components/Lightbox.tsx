"use client";

import { useEffect } from "react";
import { Download, X } from "lucide-react";

type Props = {
  url: string;
  title: string;
  downloadName: string;
  onClose: () => void;
};

/** Visualizzazione a schermo intero di un'immagine generata. */
export default function Lightbox({ url, title, downloadName, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
        <span>{title}</span>
        <div className="lightbox-actions">
          <a className="btn btn-primary btn-sm" href={url} download={downloadName}>
            <Download size={16} aria-hidden="true" /> Scarica
          </a>
          <button type="button" className="icon-btn icon-btn-light" onClick={onClose} aria-label="Chiudi">
            <X size={20} />
          </button>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={title} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
