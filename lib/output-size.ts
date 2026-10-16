import { imageSize } from "image-size";
import { appConfig } from "@/config/app.config";

export type Dimensions = { width: number; height: number };

export type OutputSizeResult =
  | { ok: true; width: number; height: number; size: string }
  | { ok: false; error: string };

/**
 * Legge le dimensioni dall'intestazione del file, senza decodificare né modificare l'immagine.
 * Applica l'orientamento EXIF (valori 5-8 = immagine ruotata di 90°), come fa il browser.
 */
export function readImageDimensions(bytes: Uint8Array): Dimensions {
  const result = imageSize(bytes);
  if (!result.width || !result.height) {
    throw new Error("Impossibile leggere le dimensioni dell'immagine.");
  }
  const rotated = result.orientation !== undefined && result.orientation >= 5;
  return rotated
    ? { width: result.height, height: result.width }
    : { width: result.width, height: result.height };
}

function roundToMultiple(value: number, multiple: number): number {
  return Math.max(multiple, Math.round(value / multiple) * multiple);
}

/**
 * Calcola la `size` di output: lato lungo = outputLongSide, lato corto proporzionale
 * al master e arrotondato al multiplo di 16 più vicino. Verifica i limiti dei modelli.
 */
export function computeOutputSize(master: Dimensions): OutputSizeResult {
  const { outputLongSide, sizeLimits } = appConfig;
  const { multipleOf, maxAspectRatio, maxLongEdge, maxShortEdge } = sizeLimits;

  const landscape = master.width >= master.height;
  const longIn = landscape ? master.width : master.height;
  const shortIn = landscape ? master.height : master.width;

  const longOut = outputLongSide;
  const shortOut = roundToMultiple((shortIn / longIn) * outputLongSide, multipleOf);

  const width = landscape ? longOut : shortOut;
  const height = landscape ? shortOut : longOut;
  const ratio = longOut / shortOut;

  if (ratio > maxAspectRatio) {
    const masterRatio = (longIn / shortIn).toFixed(2);
    return {
      ok: false,
      error:
        `Il master (${master.width}×${master.height}, rapporto ${masterRatio}:1) è troppo allungato: ` +
        `l'immagine generata sarebbe ${width}×${height}, oltre il rapporto massimo ${maxAspectRatio}:1 ` +
        `supportato dai modelli. Usa un master con proporzioni meno estreme.`,
    };
  }
  if (longOut > maxLongEdge || shortOut > maxShortEdge || longOut % multipleOf !== 0) {
    return {
      ok: false,
      error:
        `La dimensione ${width}×${height} non è supportata dai modelli ` +
        `(lati multipli di ${multipleOf}, massimo ${maxLongEdge}×${maxShortEdge}). ` +
        `Controlla outputLongSide in config/app.config.ts.`,
    };
  }
  return { ok: true, width, height, size: `${width}x${height}` };
}
