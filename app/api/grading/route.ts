import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Import grading engine modules
import {
  GRADING_VERSION,
  GradingRequest,
  GradingResult,
  QuestionAnswer,
  SubmittedAnswer,
  AnswerUpdate,
  validateAnswer,
  calculateBandScore,
  getModuleSubSectionIds,
  computeFinalTimeSpent,
  errorResponse,
} from "@/helpers/grading";

// ============================================================
// GRADING ENGINE v2.1.0
// Industry-grade IELTS grading API
// Atomic, idempotent, secure, cheat-resistant
// ============================================================
//
// PERFORMANCE & RELIABILITY OPTIMIZATIONS:
//
// 1. CONNECTION POOLING OPTIMIZATION
//    - Database connections freed immediately after RPC call
//    - Node.js performs all computation (Levenshtein, normalization) in-memory
//    - DB not blocked during CPU-intensive grading calculations
//
// 2. NETWORK LATENCY REDUCTION
//    - OLD: ~50+ round trips (answer upserts + updates + module update + flow)
//    - NEW: Exactly 3 RPC calls total (upsert answers, commit grading, flow status)
//    - Answer upsert: 1 call (was N/50 batches)
//    - Grading commit: 1 atomic call (was 40+ individual updates + module update)
//    - Flow control: 1 call (was 2-3 queries + potential update)
//
// 3. DATA INTEGRITY (ACID Transactions)
//    - All grading operations wrapped in Postgres transactions
//    - If server crashes mid-grading: ENTIRE operation rolls back
//    - No more "completed status with half-graded answers"
//    - Optimistic locking prevents concurrent grading conflicts
//    - Guarantees: Atomicity, Consistency, Isolation, Durability
//
// 4. FETCH-ONCE, PROCESS IN-MEMORY, SAVE-ONCE PATTERN
//    - Fetch all questions & student answers once
//    - Grade completely in Node.js memory (fast JS engine)
//    - Commit all results in single atomic transaction
//    - Database only handles data storage, not computation
//
// ============================================================

// Note: All type definitions, constants, normalization logic, matching engine,
// band score calculations, and helper utilities have been moved to @/helpers/grading
// for better modularity and maintainability.

// ============================================================
// MAIN GRADING API HANDLER
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // -------------------------------------------------------
    // 1. PARSE & VALIDATE REQUEST
    // -------------------------------------------------------
    let body: GradingRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON in request body", 400);
    }

    const { attemptModuleId, answers, timeSpentSeconds, timeRemainingSeconds } =
      body;

    if (!attemptModuleId || typeof attemptModuleId !== "string") {
      return errorResponse("Missing or invalid attemptModuleId", 400);
    }

    // Validate answer shape if provided
    if (answers !== undefined) {
      if (!Array.isArray(answers)) {
        return errorResponse("answers must be an array", 400);
      }
      for (const ans of answers) {
        if (!ans.reference_id || !ans.question_ref) {
          return errorResponse(
            "Each answer must have reference_id and question_ref",
            400,
          );
        }
      }
    }

    // -------------------------------------------------------
    // 2. AUTHENTICATE USER
    // -------------------------------------------------------
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Authentication required", 401);
    }

    if (!user.email) {
      return errorResponse("User email not found", 401);
    }

    // -------------------------------------------------------
    // 3. LOAD ATTEMPT MODULE & VALIDATE
    // -------------------------------------------------------
    const { data: attemptModule, error: moduleError } = await supabase
      .from("attempt_modules")
      .select(
        `
        id,
        attempt_id,
        module_id,
        status,
        started_at,
        completed_at,
        time_spent_seconds,
        score_obtained,
        band_score,
        time_remaining_seconds,
        modules (
          id,
          module_type,
          paper_id,
          center_id
        )
      `,
      )
      .eq("id", attemptModuleId)
      .single();

    if (moduleError || !attemptModule) {
      return errorResponse("Attempt module not found", 404);
    }

    const moduleType = (attemptModule as any).modules?.module_type as string;
    const moduleId = attemptModule.module_id;

    if (!moduleType) {
      return errorResponse("Module type not found", 500);
    }

    // -------------------------------------------------------
    // 4. IDEMPOTENCY — already graded? Return cached result
    // -------------------------------------------------------
    if (attemptModule.status === "completed") {
      // Already graded — determine next module for navigation using RPC
      const { data: flowResult, error: flowError } = await supabase.rpc(
        "get_attempt_flow_status",
        {
          p_attempt_id: attemptModule.attempt_id,
          p_current_module_type: moduleType,
        },
      );

      if (flowError) {
        console.error("[Grading] Flow control RPC failed:", flowError);
      }

      return NextResponse.json({
        success: true,
        alreadyGraded: true,
        totalScore: attemptModule.score_obtained ?? 0,
        bandScore: attemptModule.band_score ?? null,
        nextModuleType: flowResult?.next_module_type ?? null,
        attemptCompleted: flowResult?.attempt_completed ?? false,
        gradingVersion: GRADING_VERSION,
      } satisfies GradingResult);
    }

    // Module must be in a gradable state
    if (
      attemptModule.status !== "in_progress" &&
      attemptModule.status !== "pending" &&
      attemptModule.status !== "timeout"
    ) {
      return errorResponse(
        `Cannot grade module with status "${attemptModule.status}". Must be in_progress, pending, or timeout.`,
        400,
      );
    }

    // -------------------------------------------------------
    // 5. VALIDATE ATTEMPT OWNERSHIP (security / anti-cheat)
    // -------------------------------------------------------
    const { data: attempt, error: attemptError } = await supabase
      .from("mock_attempts")
      .select("id, student_id, paper_id, status, scheduled_test_id")
      .eq("id", attemptModule.attempt_id)
      .single();

    if (attemptError || !attempt) {
      return errorResponse("Mock attempt not found", 404);
    }

    // Prevent grading on already completed/abandoned attempts
    if (attempt.status === "completed" || attempt.status === "abandoned") {
      return errorResponse(
        `Cannot grade: attempt is already "${attempt.status}"`,
        400,
      );
    }

    // Verify student owns this attempt
    const { data: studentProfile, error: profileError } = await supabase
      .from("student_profiles")
      .select("student_id, center_id, status")
      .eq("email", user.email)
      .single();

    if (profileError || !studentProfile) {
      return errorResponse(
        "Student profile not found for authenticated user",
        403,
      );
    }

    if (studentProfile.student_id !== attempt.student_id) {
      console.warn(
        `[Grading] SECURITY: User ${user.email} tried to grade attempt belonging to student ${attempt.student_id}`,
      );
      return errorResponse("Access denied: you do not own this attempt", 403);
    }

    if (studentProfile.status !== "active") {
      return errorResponse("Student profile is not active", 403);
    }

    // Validate module belongs to the attempt's paper
    const paperId = attempt.paper_id;
    if (paperId) {
      const modulesPaperId = (attemptModule as any).modules?.paper_id;
      if (modulesPaperId && modulesPaperId !== paperId) {
        console.warn(
          `[Grading] SECURITY: Module paper_id ${modulesPaperId} doesn't match attempt paper_id ${paperId}`,
        );
        return errorResponse(
          "Module does not belong to this attempt's paper",
          403,
        );
      }
    }

    // -------------------------------------------------------
    // 6. SAVE ANSWERS (atomic RPC upsert - single round trip)
    // -------------------------------------------------------
    if (answers && answers.length > 0) {
      // Deduplicate: keep last occurrence per (reference_id, question_ref)
      const deduped = new Map<string, SubmittedAnswer>();
      for (const ans of answers) {
        const trimmedResponse =
          typeof ans.student_response === "string"
            ? ans.student_response.trim()
            : (ans.student_response ?? "");
        deduped.set(`${ans.reference_id}_${ans.question_ref}`, {
          reference_id: ans.reference_id,
          question_ref: ans.question_ref,
          student_response: trimmedResponse,
        });
      }

      const answersToSave = Array.from(deduped.values())
        .filter((a) => a.reference_id && a.question_ref)
        .map((a) => ({
          reference_id: a.reference_id,
          question_ref: a.question_ref,
          student_response: a.student_response,
        }));

      if (answersToSave.length > 0) {
        // Single atomic RPC call - replaces N database calls
        const { error: upsertError } = await supabase.rpc(
          "upsert_student_answers",
          {
            p_attempt_module_id: attemptModuleId,
            p_answers: answersToSave,
          },
        );

        if (upsertError) {
          console.error("[Grading] Answer upsert RPC failed:", upsertError);
          return errorResponse(
            `Failed to save answers: ${upsertError.message}`,
            500,
          );
        }
      }
    }

    // -------------------------------------------------------
    // 7. WRITING MODULE — save only, no auto-grading
    // -------------------------------------------------------
    if (moduleType === "writing") {
      const finalTimeSpent = computeFinalTimeSpent(
        attemptModule.started_at,
        attemptModule.time_spent_seconds,
        timeSpentSeconds,
      );

      // Mark completed (writing graded manually later)
      const { error: statusError } = await supabase
        .from("attempt_modules")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          time_spent_seconds: finalTimeSpent,
          time_remaining_seconds: timeRemainingSeconds ?? 0,
        })
        .eq("id", attemptModuleId)
        .eq("status", attemptModule.status); // Optimistic lock

      if (statusError) {
        console.error("[Grading] Writing status update failed:", statusError);
        return errorResponse("Failed to complete writing module", 500);
      }

      // Use RPC for flow control
      const { data: flowResult, error: flowError } = await supabase.rpc(
        "get_attempt_flow_status",
        {
          p_attempt_id: attemptModule.attempt_id,
          p_current_module_type: moduleType,
        },
      );

      if (flowError) {
        console.error("[Grading] Flow control RPC failed:", flowError);
      }

      return NextResponse.json({
        success: true,
        bandScore: null,
        nextModuleType: flowResult?.next_module_type ?? null,
        attemptCompleted: flowResult?.attempt_completed ?? false,
        gradingVersion: GRADING_VERSION,
      } satisfies GradingResult);
    }

    // -------------------------------------------------------
    // 8. FETCH ALL ANSWERS & CORRECT ANSWERS FOR GRADING
    // -------------------------------------------------------
    // Read ALL student answers from DB (includes incrementally saved ones)
    const { data: allStudentAnswers, error: fetchAnswersError } = await supabase
      .from("student_answers")
      .select(
        "id, attempt_module_id, reference_id, question_ref, student_response",
      )
      .eq("attempt_module_id", attemptModuleId);

    if (fetchAnswersError) {
      return errorResponse(
        `Failed to fetch answers: ${fetchAnswersError.message}`,
        500,
      );
    }

    // Get ALL question_answers for this module via sections → sub_sections
    const subSectionIds = await getModuleSubSectionIds(supabase, moduleId);

    if (subSectionIds.length === 0) {
      return errorResponse("No sub-sections found for this module", 500);
    }

    const { data: moduleQuestions, error: questionsError } = await supabase
      .from("question_answers")
      .select("id, sub_section_id, question_ref, correct_answers, marks")
      .in("sub_section_id", subSectionIds);

    if (questionsError) {
      return errorResponse(
        `Failed to fetch questions: ${questionsError.message}`,
        500,
      );
    }

    if (!moduleQuestions || moduleQuestions.length === 0) {
      return errorResponse("No questions found for this module", 500);
    }

    // -------------------------------------------------------
    // 9. GRADE ANSWERS (Listening & Reading)
    // -------------------------------------------------------
    const questionMap = new Map<string, QuestionAnswer>();
    let totalModuleMarks = 0;

    for (const q of moduleQuestions) {
      const key = `${q.sub_section_id}_${q.question_ref}`;
      questionMap.set(key, q as QuestionAnswer);
      totalModuleMarks += q.marks || 1;
    }

    // Build student answer lookup
    const studentAnswerMap = new Map<
      string,
      { id: string; student_response: string }
    >();
    for (const sa of allStudentAnswers || []) {
      const key = `${sa.reference_id}_${sa.question_ref}`;
      studentAnswerMap.set(key, {
        id: sa.id,
        student_response: sa.student_response ?? "",
      });
    }

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let totalScore = 0;

    const answerUpdates: Array<{
      id: string;
      is_correct: boolean;
      marks_awarded: number;
    }> = [];

    for (const [key, question] of questionMap) {
      const studentAnswer = studentAnswerMap.get(key);
      const questionMarks = question.marks || 1;

      // Unanswered — no penalty
      if (
        !studentAnswer ||
        !studentAnswer.student_response ||
        studentAnswer.student_response.trim() === ""
      ) {
        unansweredCount++;
        if (studentAnswer) {
          answerUpdates.push({
            id: studentAnswer.id,
            is_correct: false,
            marks_awarded: 0,
          });
        }
        continue;
      }

      // No correct answer defined — skip (treat as unanswered)
      if (!question.correct_answers) {
        unansweredCount++;
        continue;
      }

      const result = validateAnswer(
        studentAnswer.student_response,
        question.correct_answers,
        questionMarks,
      );

      if (result.isCorrect) {
        correctCount++;
        totalScore += result.marksAwarded;
      } else {
        incorrectCount++;
      }

      answerUpdates.push({
        id: studentAnswer.id,
        is_correct: result.isCorrect,
        marks_awarded: result.marksAwarded,
      });
    }

    // Integrity check
    const totalGraded = correctCount + incorrectCount + unansweredCount;
    if (totalGraded !== moduleQuestions.length) {
      console.warn(
        `[Grading] Question count mismatch: graded=${totalGraded}, expected=${moduleQuestions.length}`,
      );
    }

    // -------------------------------------------------------
    // 10. CALCULATE BAND SCORE
    // -------------------------------------------------------
    const bandScore = calculateBandScore(totalScore, moduleType);
    const percentage =
      totalModuleMarks > 0
        ? Math.round((totalScore / totalModuleMarks) * 10000) / 100
        : 0;

    const finalTimeSpent = computeFinalTimeSpent(
      attemptModule.started_at,
      attemptModule.time_spent_seconds,
      timeSpentSeconds,
    );

    // -------------------------------------------------------
    // 11. ATOMIC GRADING COMMIT (single RPC - all or nothing)
    // -------------------------------------------------------
    // This replaces multiple DB calls with ONE atomic transaction:
    // - Updates all answer results (40+ rows)
    // - Updates module stats
    // - Uses optimistic locking
    // - Ensures data integrity (no partial updates)
    const { data: commitResult, error: commitError } = await supabase.rpc(
      "commit_grading_results",
      {
        p_attempt_module_id: attemptModuleId,
        p_total_score: totalScore,
        p_band_score: bandScore,
        p_time_spent: finalTimeSpent,
        p_time_remaining: timeRemainingSeconds ?? 0,
        p_status: "completed",
        p_answers: answerUpdates.map((upd) => ({
          answer_id: upd.id,
          is_correct: upd.is_correct,
          marks_awarded: upd.marks_awarded,
        })),
        p_previous_status: attemptModule.status, // Optimistic lock
      },
    );

    if (commitError) {
      console.error("[Grading] Atomic commit failed:", commitError);

      // Handle specific concurrent modification gracefully
      if (commitError.message?.includes("CONCURRENT_MODIFICATION")) {
        return errorResponse(
          "This module has already been graded or status changed",
          409,
        );
      }

      return errorResponse(
        `Failed to commit grading: ${commitError.message}`,
        500,
      );
    }

    console.log(
      `[Grading] Atomic commit succeeded: ${commitResult?.answers_updated ?? 0} answers updated`,
    );

    // -------------------------------------------------------
    // 12. MODULE FLOW CONTROL (single RPC)
    // -------------------------------------------------------
    // Use RPC to determine next module and completion status atomically
    const { data: flowResult, error: flowError } = await supabase.rpc(
      "get_attempt_flow_status",
      {
        p_attempt_id: attemptModule.attempt_id,
        p_current_module_type: moduleType,
      },
    );

    if (flowError) {
      console.error("[Grading] Flow control RPC failed:", flowError);
      // Don't fail the entire request, use defaults
    }

    const nextModuleType = flowResult?.next_module_type ?? null;
    const attemptCompleted = flowResult?.attempt_completed ?? false;

    // -------------------------------------------------------
    // 13. RETURN RESULT
    // -------------------------------------------------------
    const elapsed = Date.now() - startTime;
    console.log(
      `[Grading v${GRADING_VERSION}] Module ${attemptModuleId} (${moduleType}) graded in ${elapsed}ms: ` +
        `${correctCount}/${moduleQuestions.length} correct, band ${bandScore}, ` +
        `next=${flowResult.nextModuleType ?? "none"}, attemptDone=${flowResult.attemptCompleted}`,
    );

    return NextResponse.json({
      success: true,
      totalScore,
      maxScore: totalModuleMarks,
      bandScore,
      correctCount,
      incorrectCount,
      unansweredCount,
      percentage,
      nextModuleType,
      attemptCompleted,
      alreadyGraded: false,
      gradingVersion: GRADING_VERSION,
    } satisfies GradingResult);
  } catch (error: any) {
    console.error("[Grading] Unexpected error:", error);
    return errorResponse(error?.message || "Internal grading error", 500);
  }
}
