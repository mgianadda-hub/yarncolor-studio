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

/**
 * Scheda "Multipack": <master>-<tag pack>[-<nome colore>].jpg (es. gomitolo-5pz-navy.jpg, gomitolo-5pz.jpg).
 * Se il nome del master contiene già il tag del pack (es. "gomitolo_5pz"), il tag non viene ripetuto.
 */
export function packDownloadName(masterName: string, packTag: string, colorName: string): string {
  const base = baseName(masterName) || "immagine";
  const parts = [base];
  if (!hasPackTag(base, packTag)) parts.push(packTag);
  const color = slugifyColorName(colorName);
  if (color) parts.push(color);
  return `${parts.join("-")}.jpg`;
}

/**
 * Vero se il nome contiene già il tag, anche con maiuscole o separatore ("5pz", "5PZ", "5 pz", "5_pz").
 * Una cifra prima del numero indica un altro pack ("15pz" non contiene "5pz").
 */
function hasPackTag(name: string, tag: string): boolean {
  const match = /^(\d+)pz$/.exec(tag);
  if (!match) return name.toLowerCase().includes(tag.toLowerCase());
  return new RegExp(`(^|\\D)${match[1]}[\\s_-]?pz`, "i").test(name);
}
