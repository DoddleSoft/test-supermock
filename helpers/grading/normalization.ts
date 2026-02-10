// ============================================================
// TEXT NORMALIZATION ENGINE
// ============================================================

import {
  NUMBER_WORD_TO_DIGIT,
  DIGIT_TO_NUMBER_WORD,
  COMPOUND_NUMBER_WORDS,
} from "./constants";

/**
 * Core text normalization for IELTS answer comparison.
 * 1. Lowercase
 * 2. Trim + collapse whitespace
 * 3. Normalize hyphens to spaces
 * 4. Remove punctuation (except internal apostrophes)
 * 5. Convert number words to digits
 * 6. Normalize common plurals
 */
export function normalizeText(text: string): string {
  if (!text || typeof text !== "string") return "";

  let result = text.toLowerCase().trim();

  // Replace hyphens with spaces for uniform comparison
  result = result.replace(/-/g, " ");

  // Remove punctuation except apostrophes within words (e.g., don't, it's)
  result = result.replace(/[^\w\s']/g, "");

  // Collapse multiple spaces
  result = result.replace(/\s+/g, " ").trim();

  // Convert compound number words first (before single words)
  for (const [compound, digit] of Object.entries(COMPOUND_NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${compound}\\b`, "gi");
    result = result.replace(regex, digit);
  }

  // Convert single number words to digits
  for (const [word, digit] of Object.entries(NUMBER_WORD_TO_DIGIT)) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, digit);
  }

  // Final whitespace cleanup
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

/**
 * Generate normalized variants for flexible matching.
 * Returns the base normalization plus singular/plural variants.
 */
export function getNormalizedVariants(text: string): string[] {
  const base = normalizeText(text);
  if (!base) return [];

  const variants = new Set<string>();
  variants.add(base);

  // Singular/plural variants
  if (base.endsWith("ies")) {
    // 'ies' → 'y' (e.g., "countries" → "country")
    variants.add(base.slice(0, -3) + "y");
  } else if (base.endsWith("ves")) {
    // 'ves' → 'f' (e.g., "knives" → "knife")
    variants.add(base.slice(0, -3) + "f");
    variants.add(base.slice(0, -3) + "fe");
  } else if (base.endsWith("es")) {
    // 'es' → '' (e.g., "boxes" → "box")
    variants.add(base.slice(0, -2));
  } else if (base.endsWith("s") && !base.endsWith("ss")) {
    // 's' → '' (e.g., "cats" → "cat")
    variants.add(base.slice(0, -1));
  }

  // Add with 's' if doesn't end with 's'
  if (!base.endsWith("s")) {
    variants.add(base + "s");
  }

  // Digit ↔ word variants for the entire base if it's a pure number/word
  if (DIGIT_TO_NUMBER_WORD[base]) {
    variants.add(DIGIT_TO_NUMBER_WORD[base]);
  }
  if (NUMBER_WORD_TO_DIGIT[base]) {
    variants.add(NUMBER_WORD_TO_DIGIT[base]);
  }

  // Hyphen ↔ space variants (add the hyphenated form back)
  if (base.includes(" ")) {
    variants.add(base.replace(/ /g, "-"));
  }

  return Array.from(variants);
}

// ============================================================
// LEVENSHTEIN DISTANCE (FUZZY MATCHING)
// ============================================================

/**
 * Calculate Levenshtein edit distance between two strings.
 * Optimized: early exit if distance already > 1.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // If length difference > 1, distance must be > 1
  if (Math.abs(a.length - b.length) > 1) return 2;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}
