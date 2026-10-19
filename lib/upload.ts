import { appConfig } from "@/config/app.config";

/**
 * Controlli sulle immagini caricate. Con `requireDestination` (modalità "Da campione") serve anche
 * l'immagine destinazione; altrimenti (modalità "Da codice colore") solo il master.
 * Restituisce un messaggio d'errore o null.
 */
export function validateUploads(
  master: unknown,
  destination: unknown,
  requireDestination = true,
): string | null {
  if (!(master instanceof File) || master.size === 0) return "Carica l'immagine master.";
  const files: [string, File][] = [["master", master]];
  if (requireDestination) {
    if (!(destination instanceof File) || destination.size === 0) {
      return "Carica l'immagine destinazione.";
    }
    files.push(["destinazione", destination]);
  }
  const accepted: readonly string[] = appConfig.acceptedImageTypes;
  for (const [label, file] of files) {
    if (!accepted.includes(file.type)) {
      return `Formato non supportato per l'immagine ${label}: usa JPG, PNG o WebP.`;
    }
  }
  const total = files.reduce((sum, [, file]) => sum + file.size, 0);
  if (total > appConfig.maxUploadTotalBytes) {
    return files.length > 1
      ? `Le due immagini superano insieme ${formatMB(appConfig.maxUploadTotalBytes)}.`
      : `L'immagine supera ${formatMB(appConfig.maxUploadTotalBytes)}.`;
  }
  return null;
}

export function formatMB(bytes: number): string {
  if (bytes < 100 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
