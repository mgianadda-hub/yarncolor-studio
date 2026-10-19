/** Nomi dei file scaricati. Le regole sono descritte in CLAUDE.md ("File scaricati"). */

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

/** Toglie gli accenti e sostituisce spazi e caratteri speciali con trattini (es. "Blu notte è" → "Blu-notte-e"). */
export function slugifyColorName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Modalità "Da campione": <master>-<destinazione>.jpg; con più immagini -1, -2, -3
 * (es. gomitolo_mohair-rosso-2.jpg).
 */
export function sampleDownloadName(
  masterName: string,
  destinationName: string,
  index: number,
  total: number,
): string {
  const base = [baseName(masterName), baseName(destinationName)].filter(Boolean).join("-") || "immagine";
  return total > 1 ? `${base}-${index + 1}.jpg` : `${base}.jpg`;
}

/**
 * Modalità "Da codice colore": <master>_<nome colore o esadecimale senza #>.jpg; con più immagini
 * _1, _2, _3 (es. gomitolo-blu_navy_1.jpg, gomitolo-blu_1A2B3C.jpg).
 */
export function hexDownloadName(
  masterName: string,
  hex: string,
  colorName: string,
  index: number,
  total: number,
): string {
  const color = slugifyColorName(colorName) || hex.replace(/^#/, "");
  const base = [baseName(masterName) || "immagine", color].join("_");
  return total > 1 ? `${base}_${index + 1}.jpg` : `${base}.jpg`;
}
