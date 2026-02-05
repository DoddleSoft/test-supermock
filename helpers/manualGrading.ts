/**
 * Manual Grading Helper Functions
 * For instructors to grade writing and speaking modules
 */

import { createClient } from "@/utils/supabase/client";

export interface ManualGradeInput {
  attemptModuleId: string;
  scoreObtained: number;
  bandScore: number;
  feedback?: string;
}

/**
 * Manually grade a writing or speaking module
 * This should only be called by instructors/teachers
 */
export async function manuallyGradeModule(input: ManualGradeInput): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // Verify this is a writing or speaking module
    const { data: moduleData, error: moduleError } = await supabase
      .from("attempt_modules")
      .select("id, attempt_id, modules(module_type)")
      .eq("id", input.attemptModuleId)
      .single();

    if (moduleError) {
      return { success: false, error: moduleError.message };
    }

    const moduleType = (moduleData as any).modules?.module_type;

    if (moduleType !== "writing" && moduleType !== "speaking") {
      return {
        success: false,
        error: "Manual grading is only for writing and speaking modules",
      };
    }

    // Update the module with manual grades
    const { error: updateError } = await supabase
      .from("attempt_modules")
      .update({
        score_obtained: input.scoreObtained,
        band_score: input.bandScore,
        feedback: input.feedback || null,
        status: "completed", // Mark as completed after grading
      })
      .eq("id", input.attemptModuleId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Update overall score for the attempt
    const attemptId = (moduleData as any).attempt_id;
    if (attemptId) {
      await updateOverallAttemptScore(attemptId);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error in manuallyGradeModule:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update overall band score for an attempt based on all completed modules
 */
async function updateOverallAttemptScore(attemptId: string): Promise<void> {
  try {
    const supabase = createClient();

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
      .map((m: any) => parseFloat(m.band_score));

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

/**
 * Get modules pending manual grading
 */
export async function getPendingGradingModules(centerId?: string): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const supabase = createClient();

    let query = supabase
      .from("attempt_modules")
      .select(
        `
        id,
        attempt_id,
        module_id,
        status,
        completed_at,
        modules(module_type, heading),
        mock_attempts(
          student_id,
          student_profiles(name, email)
        )
      `,
      )
      .eq("status", "completed")
      .is("band_score", null)
      .in("modules.module_type", ["writing", "speaking"])
      .order("completed_at", { ascending: true });

    if (centerId) {
      query = query.eq("modules.center_id", centerId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error("Error getting pending grading modules:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get module details for grading
 */
export async function getModuleForGrading(attemptModuleId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const supabase = createClient();

    // Get module info
    const { data: moduleData, error: moduleError } = await supabase
      .from("attempt_modules")
      .select(
        `
        *,
        modules(id, module_type, heading, subheading),
        mock_attempts(
          id,
          student_id,
          student_profiles(name, email)
        )
      `,
      )
      .eq("id", attemptModuleId)
      .single();

    if (moduleError) {
      return { success: false, error: moduleError.message };
    }

    // Get student answers
    const { data: answers, error: answersError } = await supabase
      .from("student_answers")
      .select("*")
      .eq("attempt_module_id", attemptModuleId)
      .order("created_at", { ascending: true });

    if (answersError) {
      return { success: false, error: answersError.message };
    }

    return {
      success: true,
      data: {
        module: moduleData,
        answers: answers || [],
      },
    };
  } catch (error: any) {
    console.error("Error getting module for grading:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
