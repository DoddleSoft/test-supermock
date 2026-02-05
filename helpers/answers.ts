import { createClient } from "@/utils/supabase/client";

export interface StudentAnswer {
  id?: string;
  attempt_module_id: string;
  sub_section_id: string;
  question_ref: string;
  student_response: string;
  is_correct?: boolean;
  marks_awarded?: number;
}

export interface AnswerValidation {
  isCorrect: boolean;
  marksAwarded: number;
  explanation?: string;
}

/**
 * Save a single answer to the database
 */
export async function saveAnswer(
  answer: StudentAnswer,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase.from("student_answers").upsert(
      {
        attempt_module_id: answer.attempt_module_id,
        sub_section_id: answer.sub_section_id,
        question_ref: answer.question_ref,
        student_response: answer.student_response,
      },
      {
        onConflict: "attempt_module_id,sub_section_id,question_ref",
      },
    );

    if (error) {
      console.error("Error saving answer:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in saveAnswer:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Save multiple answers at once
 */
export async function saveAnswersBatch(
  answers: StudentAnswer[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase.from("student_answers").upsert(
      answers.map((ans) => ({
        attempt_module_id: ans.attempt_module_id,
        sub_section_id: ans.sub_section_id,
        question_ref: ans.question_ref,
        student_response: ans.student_response,
      })),
      {
        onConflict: "attempt_module_id,sub_section_id,question_ref",
      },
    );

    if (error) {
      console.error("Error saving answers batch:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in saveAnswersBatch:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Load answers for an attempt module
 */
export async function loadAnswers(
  attemptModuleId: string,
): Promise<{ answers: StudentAnswer[]; error?: string }> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("student_answers")
      .select("*")
      .eq("attempt_module_id", attemptModuleId);

    if (error) {
      console.error("Error loading answers:", error);
      return { answers: [], error: error.message };
    }

    return { answers: data || [] };
  } catch (error: any) {
    console.error("Error in loadAnswers:", error);
    return { answers: [], error: error.message };
  }
}

/**
 * Validate a single answer against correct answer
 */
export function validateAnswer(
  studentResponse: string | string[],
  correctAnswers: any,
  marks: number = 1,
): AnswerValidation {
  // Normalize student response
  const normalizeText = (text: string): string => {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
  };

  // Handle array responses (e.g., multiple choice with multiple answers)
  if (Array.isArray(studentResponse)) {
    if (Array.isArray(correctAnswers)) {
      const normalizedStudent = studentResponse.map(normalizeText).sort();
      const normalizedCorrect = correctAnswers.map(normalizeText).sort();

      const isCorrect =
        JSON.stringify(normalizedStudent) === JSON.stringify(normalizedCorrect);

      return {
        isCorrect,
        marksAwarded: isCorrect ? marks : 0,
      };
    }
    return { isCorrect: false, marksAwarded: 0 };
  }

  // Handle string responses
  const normalizedResponse = normalizeText(
    typeof studentResponse === "string"
      ? studentResponse
      : String(studentResponse),
  );

  // Check against multiple correct answers
  if (Array.isArray(correctAnswers)) {
    const isCorrect = correctAnswers.some((answer) => {
      const normalizedCorrect = normalizeText(String(answer));
      return normalizedResponse === normalizedCorrect;
    });

    return {
      isCorrect,
      marksAwarded: isCorrect ? marks : 0,
    };
  }

  // Check against single correct answer
  if (typeof correctAnswers === "object" && correctAnswers !== null) {
    // Handle JSON format like { "answer": "value", "alternatives": ["val1", "val2"] }
    const mainAnswer = correctAnswers.answer || correctAnswers.value;
    const alternatives = correctAnswers.alternatives || [];

    if (mainAnswer) {
      const normalizedCorrect = normalizeText(String(mainAnswer));
      if (normalizedResponse === normalizedCorrect) {
        return { isCorrect: true, marksAwarded: marks };
      }
    }

    if (Array.isArray(alternatives)) {
      const isCorrect = alternatives.some((alt) => {
        const normalizedAlt = normalizeText(String(alt));
        return normalizedResponse === normalizedAlt;
      });

      if (isCorrect) {
        return { isCorrect: true, marksAwarded: marks };
      }
    }
  }

  // Simple string comparison
  const normalizedCorrect = normalizeText(String(correctAnswers));
  const isCorrect = normalizedResponse === normalizedCorrect;

  return {
    isCorrect,
    marksAwarded: isCorrect ? marks : 0,
  };
}

/**
 * Evaluate all answers for a module
 */
export async function evaluateModuleAnswers(attemptModuleId: string): Promise<{
  success: boolean;
  totalScore?: number;
  maxScore?: number;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // Get all student answers
    const { data: studentAnswers, error: answersError } = await supabase
      .from("student_answers")
      .select("*")
      .eq("attempt_module_id", attemptModuleId);

    if (answersError) throw answersError;

    if (!studentAnswers || studentAnswers.length === 0) {
      return { success: true, totalScore: 0, maxScore: 0 };
    }

    // Get sub-section IDs
    const subSectionIds = [
      ...new Set(studentAnswers.map((ans) => ans.sub_section_id)),
    ];

    // Get question answers (correct answers)
    const { data: questionAnswers, error: qaError } = await supabase
      .from("question_answers")
      .select("*")
      .in("sub_section_id", subSectionIds);

    if (qaError) throw qaError;

    let totalScore = 0;
    let maxScore = 0;

    // Create a map of question answers for quick lookup
    const qaMap = new Map(
      questionAnswers?.map((qa) => [
        `${qa.sub_section_id}_${qa.question_ref}`,
        qa,
      ]) || [],
    );

    // Evaluate each answer
    const updatedAnswers = studentAnswers.map((answer) => {
      const key = `${answer.sub_section_id}_${answer.question_ref}`;
      const correctAnswer = qaMap.get(key);

      if (!correctAnswer) {
        return {
          ...answer,
          is_correct: false,
          marks_awarded: 0,
        };
      }

      maxScore += correctAnswer.marks || 1;

      // Skip auto-evaluation for essay/writing type questions
      const subSection = correctAnswer.sub_section_id;
      // You can check question_type from sub_sections table if needed
      // For now, we'll evaluate all non-null correct_answers

      if (!correctAnswer.correct_answers) {
        // No correct answer means manual grading (writing/speaking)
        return {
          ...answer,
          is_correct: null,
          marks_awarded: null,
        };
      }

      const validation = validateAnswer(
        answer.student_response,
        correctAnswer.correct_answers,
        correctAnswer.marks || 1,
      );

      totalScore += validation.marksAwarded;

      return {
        ...answer,
        is_correct: validation.isCorrect,
        marks_awarded: validation.marksAwarded,
      };
    });

    // Update student answers with evaluation
    const { error: updateError } = await supabase
      .from("student_answers")
      .upsert(updatedAnswers);

    if (updateError) throw updateError;

    // Update attempt_module with score
    const { error: moduleUpdateError } = await supabase
      .from("attempt_modules")
      .update({
        score_obtained: totalScore,
      })
      .eq("id", attemptModuleId);

    if (moduleUpdateError) throw moduleUpdateError;

    return {
      success: true,
      totalScore,
      maxScore,
    };
  } catch (error: any) {
    console.error("Error in evaluateModuleAnswers:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Calculate band score based on score (for IELTS)
 */
export function calculateBandScore(
  score: number,
  maxScore: number,
): number | null {
  if (maxScore === 0) return null;

  const percentage = (score / maxScore) * 100;

  // IELTS band score mapping (approximate)
  if (percentage >= 90) return 9.0;
  if (percentage >= 85) return 8.5;
  if (percentage >= 80) return 8.0;
  if (percentage >= 75) return 7.5;
  if (percentage >= 70) return 7.0;
  if (percentage >= 65) return 6.5;
  if (percentage >= 60) return 6.0;
  if (percentage >= 55) return 5.5;
  if (percentage >= 50) return 5.0;
  if (percentage >= 45) return 4.5;
  if (percentage >= 40) return 4.0;
  if (percentage >= 35) return 3.5;
  if (percentage >= 30) return 3.0;
  if (percentage >= 25) return 2.5;
  if (percentage >= 20) return 2.0;
  if (percentage >= 15) return 1.5;
  return 1.0;
}

/**
 * Submit module and trigger evaluation
 */
export async function submitModule(attemptModuleId: string): Promise<{
  success: boolean;
  totalScore?: number;
  maxScore?: number;
  bandScore?: number;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // Get module info to check if already completed
    const { data: moduleInfo, error: moduleError } = await supabase
      .from("attempt_modules")
      .select("status, started_at, time_spent_seconds, modules(module_type)")
      .eq("id", attemptModuleId)
      .single();

    if (moduleError) throw moduleError;

    // Calculate time spent since module started
    const startedAt = moduleInfo.started_at
      ? new Date(moduleInfo.started_at).getTime()
      : Date.now();
    const additionalTimeSpent = Math.floor((Date.now() - startedAt) / 1000);
    const totalTimeSpent =
      (moduleInfo.time_spent_seconds || 0) + additionalTimeSpent;

    // Evaluate answers
    const evaluation = await evaluateModuleAnswers(attemptModuleId);

    if (!evaluation.success) {
      return evaluation;
    }

    // Calculate band score
    const bandScore =
      evaluation.totalScore !== undefined && evaluation.maxScore !== undefined
        ? calculateBandScore(evaluation.totalScore, evaluation.maxScore)
        : null;

    // Update attempt_module with completion
    const completedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("attempt_modules")
      .update({
        status: "completed",
        completed_at: completedAt,
        band_score: bandScore,
        score_obtained: evaluation.totalScore || 0,
        time_spent_seconds: totalTimeSpent,
        time_remaining_seconds: 0,
      })
      .eq("id", attemptModuleId);

    if (updateError) throw updateError;

    return {
      success: true,
      totalScore: evaluation.totalScore,
      maxScore: evaluation.maxScore,
      bandScore: bandScore || undefined,
    };
  } catch (error: any) {
    console.error("Error in submitModule:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
