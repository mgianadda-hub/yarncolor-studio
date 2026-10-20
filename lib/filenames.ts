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
 * Modalità "Da codice colore": <master>_<esadecimale usato senza #>[_<nome colore>].jpg
 * (es. master_1A2B3C_navy.jpg, master_1A2B3C.jpg). Con più immagini senza variazione di luminosità
 * (stesso esadecimale) si aggiunge _1, _2, _3; con la variazione ogni file ha già il proprio esadecimale.
 */
export function hexDownloadName(
  masterName: string,
  hexUsed: string,
  colorName: string,
  index: number,
  total: number,
  variation: boolean,
): string {
  const parts = [baseName(masterName) || "immagine", hexUsed.replace(/^#/, "")];
  const color = slugifyColorName(colorName);
  if (color) parts.push(color);
  if (total > 1 && !variation) parts.push(String(index + 1));
  return `${parts.join("_")}.jpg`;
}
