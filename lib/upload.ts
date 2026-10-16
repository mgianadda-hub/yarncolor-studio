import { appConfig } from "@/config/app.config";

/** Controlli comuni su master e destinazione. Restituisce un messaggio d'errore o null. */
export function validateUploads(master: unknown, destination: unknown): string | null {
  if (!(master instanceof File) || master.size === 0) return "Carica l'immagine master.";
  if (!(destination instanceof File) || destination.size === 0) {
    return "Carica l'immagine destinazione.";
  }
  const accepted: readonly string[] = appConfig.acceptedImageTypes;
  for (const [label, file] of [["master", master], ["destinazione", destination]] as const) {
    if (!accepted.includes(file.type)) {
      return `Formato non supportato per l'immagine ${label}: usa JPG, PNG o WebP.`;
    }
  }
  if (master.size + destination.size > appConfig.maxUploadTotalBytes) {
    return `Le due immagini superano insieme ${formatMB(appConfig.maxUploadTotalBytes)}.`;
  }
  return null;
}

export function formatMB(bytes: number): string {
  if (bytes < 100 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
