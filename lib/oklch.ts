/**
 * Conversioni sRGB ⇄ OKLCH (Björn Ottosson, https://bottosson.github.io/posts/oklab/) e variazione
 * di luminosità per la modalità "Da codice colore".
 * L va da 0 (nero) a 1 (bianco); la percentuale di variazione è in punti di L (5% = ±0,05).
 */

export type Oklch = { l: number; c: number; h: number };

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** "#RRGGBB" → OKLCH. */
export function hexToOklch(hex: string): Oklch {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = srgbToLinear(((n >> 16) & 255) / 255);
  const g = srgbToLinear(((n >> 8) & 255) / 255);
  const b = srgbToLinear((n & 255) / 255);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

/** OKLCH → sRGB lineare (può uscire da [0, 1] se il colore non è rappresentabile in sRGB). */
function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

function linearToHex(rgb: number[]): string {
  return (
    "#" +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, linearToSrgb(Math.min(1, Math.max(0, v))))) * 255))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/**
 * OKLCH → "#RRGGBB". Se il colore non esiste in sRGB, riduce la croma (saturazione) al minimo
 * indispensabile mantenendo luminosità e tinta. `chromaReduced` segnala che è successo.
 */
export function oklchToHex(color: Oklch): { hex: string; chromaReduced: boolean } {
  let rgb = oklchToLinear(color);
  if (inGamut(rgb)) return { hex: linearToHex(rgb), chromaReduced: false };
  let lo = 0;
  let hi = color.c;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear({ ...color, c: mid }))) lo = mid;
    else hi = mid;
  }
  rgb = oklchToLinear({ ...color, c: lo });
  return { hex: linearToHex(rgb), chromaReduced: color.c - lo > 0.005 };
}

export type HexVariant = {
  hex: string;
  /** Variazione di luminosità applicata in punti percentuali di L (es. -5, 0, +5). */
  deltaPercent: number;
  chromaReduced: boolean;
};

export type VariationResult =
  | { ok: true; variants: [HexVariant, HexVariant, HexVariant] }
  | { ok: false; error: string };

/**
 * Tre varianti dell'esadecimale: luminosità −percent, invariata, +percent (in OKLCH, stessa tinta e croma).
 * Fallisce se il colore è troppo scuro o troppo chiaro per la variazione richiesta.
 */
export function lightnessVariants(hex: string, percent: number): VariationResult {
  const base = hexToOklch(hex);
  const delta = percent / 100;
  const lightness = Math.round(base.l * 100);
  if (base.l - delta < 0) {
    return {
      ok: false,
      error: `Il colore ${hex} è troppo scuro (luminosità ${lightness}%) per scurirlo del ${percent}%. Riduci la percentuale o disattiva la variazione.`,
    };
  }
  if (base.l + delta > 1) {
    return {
      ok: false,
      error: `Il colore ${hex} è troppo chiaro (luminosità ${lightness}%) per schiarirlo del ${percent}%. Riduci la percentuale o disattiva la variazione.`,
    };
  }
  const darker = oklchToHex({ ...base, l: base.l - delta });
  const lighter = oklchToHex({ ...base, l: base.l + delta });
  if (darker.hex === hex || lighter.hex === hex) {
    return {
      ok: false,
      error: `Con il ${percent}% la variazione di ${hex} non produce colori diversi. Aumenta la percentuale.`,
    };
  }
  return {
    ok: true,
    variants: [
      { hex: darker.hex, deltaPercent: -percent, chromaReduced: darker.chromaReduced },
      { hex, deltaPercent: 0, chromaReduced: false },
      { hex: lighter.hex, deltaPercent: percent, chromaReduced: lighter.chromaReduced },
    ],
  };
}
