import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface StudentAnswer {
  id: string;
  attempt_module_id: string;
  reference_id: string;
  question_ref: string;
  student_response: string;
  is_correct?: boolean;
  marks_awarded?: number;
}

interface QuestionAnswer {
  id: string;
  sub_section_id: string;
  question_ref: string;
  correct_answers: any;
  options: any;
  explanation: string | null;
  marks: number;
}

/**
 * IELTS-compliant text normalization
 * 1. Lowercase
 * 2. Trim leading/trailing spaces
 * 3. Collapse multiple spaces into one
 * 4. Remove punctuation except internal word separators
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " "); // Collapse spaces
}

/**
 * Check if student answer matches correct answer with flexible article handling
 * Accepts: "hospital", "the hospital", "a hospital" all as valid for "hospital"
 */
function matchesWithArticles(
  studentNormalized: string,
  correctNormalized: string,
): boolean {
  // Direct match
  if (studentNormalized === correctNormalized) {
    return true;
  }

  // Student added "the " or "a " before the correct answer
  if (
    studentNormalized === `the ${correctNormalized}` ||
    studentNormalized === `a ${correctNormalized}`
  ) {
    return true;
  }

  // Correct answer has "the " or "a ", student omitted it
  if (
    correctNormalized === `the ${studentNormalized}` ||
    correctNormalized === `a ${studentNormalized}`
  ) {
    return true;
  }

  return false;
}

/**
 * Validate a single answer against correct answer with IELTS-style flexibility
 */
function validateAnswer(
  studentResponse: string | string[],
  correctAnswers: any,
  marks: number = 1,
): { isCorrect: boolean; marksAwarded: number } {
  // Parse student response if it's JSON-encoded
  let parsedStudentResponse = studentResponse;
  if (typeof studentResponse === "string") {
    try {
      const parsed = JSON.parse(studentResponse);
      if (Array.isArray(parsed)) {
        parsedStudentResponse = parsed;
      }
    } catch {
      // Not JSON, treat as plain text
    }
  }

  // Handle array responses (e.g., multiple choice with multiple answers)
  if (Array.isArray(parsedStudentResponse)) {
    if (Array.isArray(correctAnswers)) {
      const normalizedStudent = parsedStudentResponse
        .map((ans) => normalizeText(String(ans)))
        .sort();
      const normalizedCorrect = correctAnswers
        .map((ans) => normalizeText(String(ans)))
        .sort();

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
    typeof parsedStudentResponse === "string"
      ? parsedStudentResponse
      : String(parsedStudentResponse),
  );

  // Check against multiple correct answers
  if (Array.isArray(correctAnswers)) {
    const isCorrect = correctAnswers.some((answer) => {
      const normalizedCorrect = normalizeText(String(answer));
      return matchesWithArticles(normalizedResponse, normalizedCorrect);
    });

    return {
      isCorrect,
      marksAwarded: isCorrect ? marks : 0,
    };
  }

  // Check against single correct answer with alternatives
  if (typeof correctAnswers === "object" && correctAnswers !== null) {
    const mainAnswer = correctAnswers.answer || correctAnswers.value;
    const alternatives = correctAnswers.alternatives || [];

    if (mainAnswer) {
      const normalizedCorrect = normalizeText(String(mainAnswer));
      if (matchesWithArticles(normalizedResponse, normalizedCorrect)) {
        return { isCorrect: true, marksAwarded: marks };
      }
    }

    if (Array.isArray(alternatives)) {
      const isCorrect = alternatives.some((alt) => {
        const normalizedAlt = normalizeText(String(alt));
        return matchesWithArticles(normalizedResponse, normalizedAlt);
      });

      if (isCorrect) {
        return { isCorrect: true, marksAwarded: marks };
      }
    }
  }

  // Simple string comparison with article flexibility
  const normalizedCorrect = normalizeText(String(correctAnswers));
  const isCorrect = matchesWithArticles(normalizedResponse, normalizedCorrect);

  return {
    isCorrect,
    marksAwarded: isCorrect ? marks : 0,
  };
}

/**
 * REAL IELTS band score tables
 * Based on official IELTS scoring for Reading and Listening
 */
const IELTS_READING_BANDS: Record<number, number> = {
  40: 9.0,
  39: 9.0,
  38: 8.5,
  37: 8.5,
  36: 8.0,
  35: 8.0,
  34: 7.5,
  33: 7.5,
  32: 7.0,
  31: 7.0,
  30: 7.0,
  29: 6.5,
  28: 6.5,
  27: 6.5,
  26: 6.0,
  25: 6.0,
  24: 6.0,
  23: 6.0,
  22: 5.5,
  21: 5.5,
  20: 5.5,
  19: 5.5,
  18: 5.0,
  17: 5.0,
  16: 5.0,
  15: 5.0,
  14: 4.5,
  13: 4.5,
  12: 4.5,
  11: 4.0,
  10: 4.0,
  9: 4.0,
  8: 3.5,
  7: 3.5,
  6: 3.5,
  5: 3.0,
  4: 3.0,
  3: 2.5,
  2: 2.5,
  1: 2.0,
  0: 1.0,
};

const IELTS_LISTENING_BANDS: Record<number, number> = {
  40: 9.0,
  39: 9.0,
  38: 8.5,
  37: 8.5,
  36: 8.0,
  35: 8.0,
  34: 7.5,
  33: 7.5,
  32: 7.5,
  31: 7.0,
  30: 7.0,
  29: 6.5,
  28: 6.5,
  27: 6.5,
  26: 6.5,
  25: 6.0,
  24: 6.0,
  23: 6.0,
  22: 5.5,
  21: 5.5,
  20: 5.5,
  19: 5.5,
  18: 5.5,
  17: 5.0,
  16: 5.0,
  15: 5.0,
  14: 5.0,
  13: 5.0,
  12: 4.5,
  11: 4.5,
  10: 4.5,
  9: 4.0,
  8: 4.0,
  7: 4.0,
  6: 4.0,
  5: 3.5,
  4: 3.5,
  3: 3.0,
  2: 3.0,
  1: 2.5,
  0: 1.0,
};

/**
 * Calculate IELTS band score based on raw score using official tables
 */
function calculateBandScore(
  rawScore: number,
  moduleType: string,
): number | null {
  // Ensure raw score is non-negative integer
  const score = Math.max(0, Math.floor(rawScore));

  if (moduleType === "reading") {
    return IELTS_READING_BANDS[score] || 1.0;
  }

  if (moduleType === "listening") {
    return IELTS_LISTENING_BANDS[score] || 1.0;
  }

  // Writing and speaking are manually graded
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { attemptModuleId } = await request.json();

    if (!attemptModuleId) {
      return NextResponse.json(
        { success: false, error: "Missing attemptModuleId" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Get the module type and status to validate grading
    const { data: attemptModule, error: moduleError } = await supabase
      .from("attempt_modules")
      .select("*, modules(module_type)")
      .eq("id", attemptModuleId)
      .single();

    if (moduleError || !attemptModule) {
      return NextResponse.json(
        { success: false, error: "Attempt module not found" },
        { status: 404 },
      );
    }

    const moduleType = (attemptModule as any).modules?.module_type;
    const status = attemptModule.status;

    // Only grade if status is completed or timeout
    if (status !== "completed" && status !== "timeout") {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot grade module with status: ${status}. Must be 'completed' or 'timeout'.`,
        },
        { status: 400 },
      );
    }

    // Get all student answers
    const { data: studentAnswers, error: answersError } = await supabase
      .from("student_answers")
      .select("*")
      .eq("attempt_module_id", attemptModuleId);

    if (answersError) {
      return NextResponse.json(
        { success: false, error: answersError.message },
        { status: 500 },
      );
    }

    if (!studentAnswers || studentAnswers.length === 0) {
      // No answers submitted - set score to 0 for reading/listening
      if (moduleType === "reading" || moduleType === "listening") {
        const bandScore = calculateBandScore(0, moduleType);

        await supabase
          .from("attempt_modules")
          .update({
            score_obtained: 0,
            band_score: bandScore,
          })
          .eq("id", attemptModuleId);

        return NextResponse.json({
          success: true,
          totalScore: 0,
          maxScore: 0,
          bandScore,
        });
      }

      return NextResponse.json({
        success: true,
        totalScore: 0,
        maxScore: 0,
        bandScore: null,
      });
    }

    // Get reference IDs (sub_section_ids)
    const referenceIds = [
      ...new Set(studentAnswers.map((ans: any) => ans.reference_id)),
    ];

    // Get question answers (correct answers and marks) - source of truth
    const { data: questionAnswers, error: qaError } = await supabase
      .from("question_answers")
      .select("*")
      .in("sub_section_id", referenceIds);

    if (qaError) {
      return NextResponse.json(
        { success: false, error: qaError.message },
        { status: 500 },
      );
    }

    // Calculate maxScore deterministically from question_answers
    const qaMap = new Map(
      questionAnswers?.map((qa: QuestionAnswer) => [
        `${qa.sub_section_id}_${qa.question_ref}`,
        qa,
      ]) || [],
    );

    let maxScore = 0;
    qaMap.forEach((qa) => {
      maxScore += qa.marks || 1;
    });

    let totalScore = 0;

    // Evaluate each answer
    const answerUpdates: Array<{
      id: string;
      is_correct: boolean | null;
      marks_awarded: number | null;
    }> = studentAnswers.map((answer: StudentAnswer) => {
      const key = `${answer.reference_id}_${answer.question_ref}`;
      const correctAnswer = qaMap.get(key);

      if (!correctAnswer) {
        // Question not found - skip
        return {
          id: answer.id,
          is_correct: false,
          marks_awarded: 0,
        };
      }

      // Auto-grade only for reading and listening modules
      if (moduleType === "reading" || moduleType === "listening") {
        // Skip if no correct answers (manual grading required)
        if (!correctAnswer.correct_answers) {
          return {
            id: answer.id,
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
          id: answer.id,
          is_correct: validation.isCorrect,
          marks_awarded: validation.marksAwarded,
        };
      } else {
        // For writing and speaking, don't auto-grade
        return {
          id: answer.id,
          is_correct: null,
          marks_awarded: null,
        };
      }
    });

    // Update student answers safely - only is_correct and marks_awarded
    for (const update of answerUpdates) {
      const { error: updateError } = await supabase
        .from("student_answers")
        .update({
          is_correct: update.is_correct,
          marks_awarded: update.marks_awarded,
        })
        .eq("id", update.id);

      if (updateError) {
        console.error(
          `Error updating answer ${update.id}:`,
          updateError.message,
        );
      }
    }

    // Calculate band score using real IELTS tables
    const bandScore =
      moduleType === "reading" || moduleType === "listening"
        ? calculateBandScore(totalScore, moduleType)
        : null;

    // Update attempt_module safely - only score_obtained and band_score
    if (moduleType === "reading" || moduleType === "listening") {
      const { error: moduleUpdateError } = await supabase
        .from("attempt_modules")
        .update({
          score_obtained: totalScore,
          band_score: bandScore,
        })
        .eq("id", attemptModuleId);

      if (moduleUpdateError) {
        return NextResponse.json(
          { success: false, error: moduleUpdateError.message },
          { status: 500 },
        );
      }
    }
    // For writing/speaking, do NOT touch scores - leave for manual grading

    // Calculate overall score for the attempt if all modules are completed
    await updateOverallScore(supabase, attemptModule.attempt_id);

    return NextResponse.json({
      success: true,
      totalScore:
        moduleType === "reading" || moduleType === "listening"
          ? totalScore
          : undefined,
      maxScore:
        moduleType === "reading" || moduleType === "listening"
          ? maxScore
          : undefined,
      bandScore: bandScore || undefined,
    });
  } catch (error: any) {
    console.error("Grading API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * Update overall band score for the attempt based on all completed modules
 */
async function updateOverallScore(supabase: any, attemptId: string) {
  try {
    // Get all completed modules for this attempt
    const { data: modules, error: modulesError } = await supabase
      .from("attempt_modules")
      .select("module_id, band_score, modules(module_type)")
      .eq("attempt_id", attemptId)
      .eq("status", "completed");

    if (modulesError || !modules || modules.length === 0) {
      return;
    }

    // Calculate average band score (only for modules with band_score)
    const validScores = modules
      .filter((m: any) => m.band_score !== null)
      .map((m: any) => m.band_score);

    if (validScores.length === 0) {
      return;
    }

    const averageScore =
      validScores.reduce((sum: number, score: number) => sum + score, 0) /
      validScores.length;

    // Round to nearest 0.5
    const overallBandScore = Math.round(averageScore * 2) / 2;

    // Update mock_attempts with overall band score
    await supabase
      .from("mock_attempts")
      .update({
        overall_band_score: overallBandScore,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", attemptId);
  } catch (error) {
    console.error("Error updating overall score:", error);
  }
}
