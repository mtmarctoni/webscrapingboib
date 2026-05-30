/**
 * Normalizes a string for case- and accent-insensitive comparison.
 * - Lowercases
 * - NFD-decomposes accented characters
 * - Strips combining diacritical marks (U+0300–U+036F)
 */
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
