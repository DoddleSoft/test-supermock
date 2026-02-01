// Utility for persisting answers in localStorage across page refreshes

export interface StoredAnswer {
  questionRef: string;
  referenceId: string; // subsection_id for reading/listening, section_id for writing
  studentResponse: string;
  moduleType: "reading" | "listening" | "writing";
  timestamp: number;
}

export interface ModuleAnswers {
  attemptModuleId: string;
  answers: StoredAnswer[];
}

const STORAGE_KEY_PREFIX = "exam_answers_";

/**
 * Get storage key for a specific attempt
 */
function getStorageKey(attemptId: string): string {
  return `${STORAGE_KEY_PREFIX}${attemptId}`;
}

/**
 * Load answers from localStorage for a specific attempt
 */
export function loadAnswersFromStorage(
  attemptId: string,
): ModuleAnswers | null {
  try {
    const key = getStorageKey(attemptId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error("Error loading answers from storage:", error);
    return null;
  }
}

/**
 * Save answers to localStorage
 */
export function saveAnswersToStorage(
  attemptId: string,
  moduleAnswers: ModuleAnswers,
): void {
  try {
    const key = getStorageKey(attemptId);
    localStorage.setItem(key, JSON.stringify(moduleAnswers));
  } catch (error) {
    console.error("Error saving answers to storage:", error);
  }
}

/**
 * Update a single answer in storage
 */
export function updateAnswerInStorage(
  attemptId: string,
  attemptModuleId: string,
  answer: StoredAnswer,
): void {
  const existing = loadAnswersFromStorage(attemptId) || {
    attemptModuleId,
    answers: [],
  };

  // Find and update or add new
  const index = existing.answers.findIndex(
    (a) =>
      a.questionRef === answer.questionRef &&
      a.referenceId === answer.referenceId,
  );

  if (index >= 0) {
    existing.answers[index] = { ...answer, timestamp: Date.now() };
  } else {
    existing.answers.push({ ...answer, timestamp: Date.now() });
  }

  saveAnswersToStorage(attemptId, existing);
}

/**
 * Get specific answer from storage
 */
export function getAnswerFromStorage(
  attemptId: string,
  questionRef: string,
  referenceId: string,
): string | null {
  const stored = loadAnswersFromStorage(attemptId);
  if (!stored) return null;

  const answer = stored.answers.find(
    (a) => a.questionRef === questionRef && a.referenceId === referenceId,
  );

  return answer?.studentResponse || null;
}

/**
 * Clear all answers for an attempt
 */
export function clearAnswersFromStorage(attemptId: string): void {
  try {
    const key = getStorageKey(attemptId);
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Error clearing answers from storage:", error);
  }
}

/**
 * Get all answers for a specific module type
 */
export function getModuleAnswersFromStorage(
  attemptId: string,
  moduleType: "reading" | "listening" | "writing",
): StoredAnswer[] {
  const stored = loadAnswersFromStorage(attemptId);
  if (!stored) return [];

  return stored.answers.filter((a) => a.moduleType === moduleType);
}
