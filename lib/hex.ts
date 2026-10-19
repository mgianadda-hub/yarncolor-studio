/** Segnaposto del prompt "Da codice colore", sostituito lato server con l'esadecimale normalizzato. */
export const TARGET_HEX_PLACEHOLDER = "{TARGET_HEX}";

/**
 * Valida un codice esadecimale a 6 cifre, con o senza "#", e lo normalizza in maiuscolo con "#"
 * (es. "1a2b3c" → "#1A2B3C"). Restituisce null se non è valido.
 */
export function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

/** Sostituisce ogni occorrenza di {TARGET_HEX} nel prompt. */
export function fillHexPrompt(prompt: string, hex: string): string {
  return prompt.split(TARGET_HEX_PLACEHOLDER).join(hex);
}
