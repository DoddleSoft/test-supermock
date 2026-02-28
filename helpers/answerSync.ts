import { createClient } from "@/utils/supabase/client";
import {
  loadAnswersFromStorage,
  clearAnswersFromStorage,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  StoredAnswer,
} from "@/utils/answerStorage";

export interface SaveAnswerParams {
  attemptModuleId: string;
  referenceId: string; // subsection_id for reading/listening, section_id for writing
  questionRef: string;
  studentResponse: string;
}

/**
 * Save a single answer to the database
 */
export async function saveAnswerToDatabase(
  params: SaveAnswerParams,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase.from("student_answers").upsert(
      {
        attempt_module_id: params.attemptModuleId,
        reference_id: params.referenceId,
        question_ref: params.questionRef,
        student_response: params.studentResponse,
      },
      {
        onConflict: "attempt_module_id,reference_id,question_ref",
      },
    );

    if (error) {
      console.error("Error saving answer to database:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error saving answer to database:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Save multiple answers to the database in batch
 */
export async function saveAnswersBatchToDatabase(
  answers: SaveAnswerParams[],
): Promise<{ success: boolean; error?: string; savedCount: number }> {
  try {
    const supabase = createClient();

    const records = answers.map((a) => ({
      attempt_module_id: a.attemptModuleId,
      reference_id: a.referenceId,
      question_ref: a.questionRef,
      student_response: a.studentResponse,
    }));

    const { error, count } = await supabase
      .from("student_answers")
      .upsert(records, {
        onConflict: "attempt_module_id,reference_id,question_ref",
      });

    if (error) {
      console.error("Error saving answers batch to database:", error);
      return { success: false, error: error.message, savedCount: 0 };
    }

    return { success: true, savedCount: count || records.length };
  } catch (error) {
    console.error("Error saving answers batch to database:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      savedCount: 0,
    };
  }
}

/**
 * Save all stored answers from localStorage to database.
 * Only syncs answers that have changed since the last successful sync
 * to avoid redundant database writes on Ctrl+S.
 */
export async function syncStoredAnswersToDatabase(
  attemptId: string,
  attemptModuleId: string,
): Promise<{ success: boolean; error?: string; savedCount: number }> {
  try {
    const stored = loadAnswersFromStorage(attemptId);
    if (!stored || stored.answers.length === 0) {
      return { success: true, savedCount: 0 };
    }

    // Only sync answers modified since the last successful sync
    const lastSync = getLastSyncTimestamp(attemptId);
    const unsyncedAnswers = stored.answers.filter(
      (a) => a.timestamp > lastSync,
    );

    if (unsyncedAnswers.length === 0) {
      return { success: true, savedCount: 0 };
    }

    const params: SaveAnswerParams[] = unsyncedAnswers.map((a) => ({
      attemptModuleId,
      referenceId: a.referenceId,
      questionRef: a.questionRef,
      studentResponse: a.studentResponse,
    }));

    const result = await saveAnswersBatchToDatabase(params);

    if (result.success) {
      setLastSyncTimestamp(attemptId, Date.now());
    }

    return result;
  } catch (error) {
    console.error("Error syncing stored answers to database:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      savedCount: 0,
    };
  }
}

/**
 * Submit all answers and clear localStorage
 */
export async function submitAndClearAnswers(
  attemptId: string,
  attemptModuleId: string,
): Promise<{ success: boolean; error?: string; savedCount: number }> {
  const result = await syncStoredAnswersToDatabase(attemptId, attemptModuleId);

  if (result.success) {
    clearAnswersFromStorage(attemptId);
  }

  return result;
}
