// ============================================================
// BAND SCORE CALCULATION
// ============================================================

import {
  IELTS_LISTENING_BANDS,
  IELTS_READING_BANDS,
  MODULE_ORDER,
} from "./constants";

/**
 * Convert raw score to IELTS band using official lookup tables.
 * Returns null for writing/speaking (manually graded).
 */
export function calculateBandScore(
  rawScore: number,
  moduleType: string,
): number | null {
  if (moduleType !== "reading" && moduleType !== "listening") return null;

  const score = Math.max(0, Math.min(40, Math.floor(rawScore)));
  const table =
    moduleType === "listening" ? IELTS_LISTENING_BANDS : IELTS_READING_BANDS;

  return table[score] ?? 1.0;
}

/**
 * Get the next module type in the sequence (listening → reading → writing)
 */
export function getNextModuleType(currentType: string): string | null {
  const idx = MODULE_ORDER.indexOf(
    currentType as (typeof MODULE_ORDER)[number],
  );
  if (idx === -1 || idx >= MODULE_ORDER.length - 1) return null;
  return MODULE_ORDER[idx + 1];
}
