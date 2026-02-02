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
 * Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Validate a single answer against correct answer
 */
function validateAnswer(
  studentResponse: string | string[],
  correctAnswers: any,
  marks: number = 1,
): { isCorrect: boolean; marksAwarded: number } {
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

  // Check against single correct answer with alternatives
  if (typeof correctAnswers === "object" && correctAnswers !== null) {
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
 * Calculate IELTS band score based on percentage
 */
function calculateBandScore(score: number, maxScore: number): number | null {
  if (maxScore === 0) return null;

  const percentage = (score / maxScore) * 100;

  // IELTS band score mapping
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

    // Get the module type to determine if auto-grading is applicable
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

    // Get question answers (correct answers and marks)
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

    let totalScore = 0;
    let maxScore = 0;

    // Create a map of question answers for quick lookup
    const qaMap = new Map(
      questionAnswers?.map((qa: QuestionAnswer) => [
        `${qa.sub_section_id}_${qa.question_ref}`,
        qa,
      ]) || [],
    );

    // Evaluate each answer
    const updatedAnswers = studentAnswers.map((answer: StudentAnswer) => {
      const key = `${answer.reference_id}_${answer.question_ref}`;
      const correctAnswer = qaMap.get(key);

      if (!correctAnswer) {
        return {
          ...answer,
          is_correct: false,
          marks_awarded: 0,
        };
      }

      maxScore += correctAnswer.marks || 1;

      // Auto-grade only for reading and listening modules
      if (moduleType === "reading" || moduleType === "listening") {
        // Skip if no correct answers (manual grading required)
        if (!correctAnswer.correct_answers) {
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
      } else {
        // For writing and speaking, don't auto-grade
        return {
          ...answer,
          is_correct: null,
          marks_awarded: null,
        };
      }
    });

    // Update student answers with evaluation results
    const { error: updateError } = await supabase
      .from("student_answers")
      .upsert(updatedAnswers);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 },
      );
    }

    // Calculate band score
    const bandScore =
      moduleType === "reading" || moduleType === "listening"
        ? calculateBandScore(totalScore, maxScore)
        : null;

    // Update attempt_module with score (only for auto-graded modules)
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
