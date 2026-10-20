/**
 * Configurazione dell'app. Il prompt di default sta in `config/default-prompt.txt`.
 */

export type ImageModelOption = {
  id: string;
  /** Nota mostrata accanto al nome nel selettore. */
  note?: string;
};

export const appConfig = {
  /** Modelli selezionabili, nell'ordine in cui compaiono nel selettore. */
  models: [
    { id: "gpt-image-2.5-sunburst", note: "default, più dettaglio" },
    { id: "gpt-image-2.5-flare", note: "più veloce" },
    { id: "gpt-image-2" },
  ] satisfies ImageModelOption[],
  defaultModel: "gpt-image-2.5-sunburst",

  /** Lato lungo dell'immagine generata, in pixel. Il lato corto è proporzionale al master. */
  outputLongSide: 1504,

  /**
   * Vincoli di `size` dell'endpoint images/edits, uguali per gpt-image-2,
   * gpt-image-2.5-sunburst e gpt-image-2.5-flare (SDK openai 7.34.0):
   * lati multipli di 16, rapporto tra 1:3 e 3:1, risoluzione massima 3840x2160,
   * oltre 2560x1440 la risoluzione è "experimental".
   */
  sizeLimits: {
    multipleOf: 16,
    maxAspectRatio: 3,
    maxLongEdge: 3840,
    maxShortEdge: 2160,
    experimentalAbovePixels: 2560 * 1440,
  },

  /** Qualità di generazione del modello. */
  quality: "high",
  outputFormat: "jpeg",
  /** Compressione JPEG (0-100). */
  outputCompression: 80,

  /** Numero di immagini selezionabili; ogni immagine è una chiamata separata con n=1. */
  imageCountOptions: [1, 3],

  /**
   * Modalità "Da codice colore", 3 immagini: variazione di luminosità in OKLCH, in punti percentuali
   * di L (5 = −0,05 / +0,05). Le immagini usano esadecimale −%, impostato, +%.
   */
  hexVariation: {
    defaultPercent: 5,
    minPercent: 0.5,
    maxPercent: 50,
  },

  /** Formati accettati per master e destinazione. */
  acceptedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  /** Peso massimo complessivo dei due file: Vercel accetta richieste fino a ~4,5 MB. */
  maxUploadTotalBytes: 4 * 1024 * 1024,
} as const;

export type ModelId = (typeof appConfig.models)[number]["id"];

export function isAllowedModel(model: string): model is ModelId {
  return appConfig.models.some((m) => m.id === model);
}
