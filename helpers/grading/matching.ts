// ============================================================
// ANSWER MATCHING ENGINE
// ============================================================

import {
  normalizeText,
  getNormalizedVariants,
  levenshteinDistance,
} from "./normalization";

/**
 * Flexible article handling: accept with/without "the", "a", "an"
 */
function matchWithArticles(student: string, correct: string): boolean {
  if (student === correct) return true;

  const articles = ["the ", "a ", "an "];

  // Student added an article
  for (const article of articles) {
    if (student === article + correct) return true;
  }

  // Correct answer has an article, student omitted it
  for (const article of articles) {
    if (correct === article + student) return true;
  }

  return false;
}

/**
 * Match a single student answer against a single correct answer string.
 * Uses normalization variants, article handling, and fuzzy matching.
 */
export function matchSingleAnswer(student: string, correct: string): boolean {
  const studentVariants = getNormalizedVariants(student);
  const correctVariants = getNormalizedVariants(correct);

  // Exact match across all variant combinations
  for (const sv of studentVariants) {
    for (const cv of correctVariants) {
      if (matchWithArticles(sv, cv)) {
        return true;
      }
    }
  }

  // Fuzzy match: Levenshtein distance ≤ 1 on base normalized forms
  // Only for answers with length ≥ 4 to avoid false positives on short words
  const studentBase = normalizeText(student);
  const correctBase = normalizeText(correct);

  if (studentBase.length >= 4 && correctBase.length >= 4) {
    if (levenshteinDistance(studentBase, correctBase) <= 1) {
      return true;
    }
  }

  return false;
}

/**
 * Validate a student's response against correct answers from the database.
 * Supports: single string, array of strings, object with alternatives.
 */
export function validateAnswer(
  studentResponse: string | string[],
  correctAnswers: any,
  marks: number = 1,
): { isCorrect: boolean; marksAwarded: number } {
  // Parse student response if JSON-encoded
  let parsedResponse = studentResponse;
  if (typeof studentResponse === "string") {
    try {
      const parsed = JSON.parse(studentResponse);
      if (Array.isArray(parsed)) {
        parsedResponse = parsed;
      }
    } catch {
      // Not JSON, use as plain text
    }
  }

  // --- Array response (e.g., multi-select) ---
  if (Array.isArray(parsedResponse)) {
    if (Array.isArray(correctAnswers)) {
      const normalizedStudent = parsedResponse
        .map((a) => normalizeText(String(a)))
        .filter(Boolean)
        .sort();
      const normalizedCorrect = correctAnswers
        .map((a: any) => normalizeText(String(a)))
        .filter(Boolean)
        .sort();

      if (normalizedStudent.length !== normalizedCorrect.length) {
        return { isCorrect: false, marksAwarded: 0 };
      }

      const allMatch = normalizedStudent.every((sv, i) =>
        matchSingleAnswer(sv, normalizedCorrect[i]),
      );

      return { isCorrect: allMatch, marksAwarded: allMatch ? marks : 0 };
    }
    return { isCorrect: false, marksAwarded: 0 };
  }

  // --- String response ---
  const responseStr =
    typeof parsedResponse === "string"
      ? parsedResponse
      : String(parsedResponse);
  const trimmed = responseStr.trim();
  if (!trimmed) return { isCorrect: false, marksAwarded: 0 };

  // Check against array of correct answers (accept any one)
  if (Array.isArray(correctAnswers)) {
    const isCorrect = correctAnswers.some((answer: any) =>
      matchSingleAnswer(trimmed, String(answer)),
    );
    return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
  }

  // Check against object with main answer + alternatives
  if (typeof correctAnswers === "object" && correctAnswers !== null) {
    const mainAnswer =
      correctAnswers.answer || correctAnswers.value || correctAnswers.text;
    const alternatives = correctAnswers.alternatives || [];

    if (mainAnswer && matchSingleAnswer(trimmed, String(mainAnswer))) {
      return { isCorrect: true, marksAwarded: marks };
    }

    if (Array.isArray(alternatives)) {
      const isCorrect = alternatives.some((alt: any) =>
        matchSingleAnswer(trimmed, String(alt)),
      );
      if (isCorrect) {
        return { isCorrect: true, marksAwarded: marks };
      }
    }

    return { isCorrect: false, marksAwarded: 0 };
  }

  // Check against simple string
  const isCorrect = matchSingleAnswer(trimmed, String(correctAnswers));
  return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
}
