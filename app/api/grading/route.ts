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
  computeFinalTimeSpent,
  errorResponse,
} from "@/helpers/grading";

// ============================================================
// GRADING ENGINE v2.2.0
// Industry-grade IELTS grading API
// Atomic, idempotent, secure, cheat-resistant
// ============================================================

const MODULE_DURATIONS: Record<string, number> = {
  listening: 30 * 60,
  reading: 60 * 60,
  writing: 60 * 60,
  speaking: 15 * 60,
};

// Grace period beyond deadline to still accept submissions (seconds)
const LATE_SUBMISSION_GRACE_SECONDS = 60;

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
      return errorResponse("Module configuration error", 500);
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
      return errorResponse("Module is not in a gradable state", 400);
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
      return errorResponse("Cannot grade: attempt is no longer active", 400);
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
    // 5.5 SERVER-SIDE TIME VALIDATION (anti-cheat)
    // Computes deadline using both started_at + duration AND
    // stored time_spent + time_remaining to handle reconnection
    // and interrupted sessions robustly.
    // -------------------------------------------------------
    let serverTimeRemaining = 0;
    let isLateSubmission = false;

    if (attemptModule.started_at && moduleType) {
      const durationSec = MODULE_DURATIONS[moduleType] || 3600;
      const startedAtMs = new Date(attemptModule.started_at).getTime();

      // Primary deadline: started_at + module duration
      const absoluteDeadlineMs = startedAtMs + durationSec * 1000;

      // Adjusted deadline: use stored time_spent + time_remaining from DB
      // This handles interrupted sessions where the timer was paused/synced.
      // If time_remaining_seconds was last synced at time T, then:
      //   T ≈ started_at + time_spent_seconds (wall clock since start)
      //   Adjusted deadline = T + time_remaining_seconds
      // For uninterrupted sessions: time_spent + time_remaining ≈ duration,
      // so adjusted ≈ absolute. For interrupted sessions this is more accurate.
      let effectiveDeadlineMs = absoluteDeadlineMs;

      const storedTimeSpent = attemptModule.time_spent_seconds ?? 0;
      const storedTimeRemaining = attemptModule.time_remaining_seconds;

      if (
        storedTimeRemaining !== null &&
        storedTimeRemaining !== undefined &&
        storedTimeSpent > 0
      ) {
        const lastSyncApproxMs = startedAtMs + storedTimeSpent * 1000;
        const adjustedDeadlineMs =
          lastSyncApproxMs + storedTimeRemaining * 1000;
        // Use the more conservative (earlier) deadline for anti-cheat
        effectiveDeadlineMs = Math.min(absoluteDeadlineMs, adjustedDeadlineMs);
      }

      serverTimeRemaining = Math.max(
        0,
        Math.floor((effectiveDeadlineMs - Date.now()) / 1000),
      );

      // Flag suspiciously high client-reported time remaining
      if (
        timeRemainingSeconds !== undefined &&
        timeRemainingSeconds > serverTimeRemaining + 30
      ) {
        console.warn(
          `[Grading] SECURITY: Client time remaining (${timeRemainingSeconds}s) exceeds ` +
            `server computed (${serverTimeRemaining}s) by ${timeRemainingSeconds - serverTimeRemaining}s`,
        );
      }

      // REJECT late submissions beyond grace period
      if (
        Date.now() >
        effectiveDeadlineMs + LATE_SUBMISSION_GRACE_SECONDS * 1000
      ) {
        const overrunSec = Math.round(
          (Date.now() - effectiveDeadlineMs) / 1000,
        );
        console.warn(
          `[Grading] SECURITY: Late submission REJECTED for module ${attemptModuleId} (${moduleType}). ` +
            `${overrunSec}s past deadline. started_at=${attemptModule.started_at}`,
        );
        isLateSubmission = true;
      }
    }

    // -------------------------------------------------------
    // 5.6 HANDLE LATE SUBMISSIONS — save answers, mark as
    //     timeout, and reject the grading request.
    // -------------------------------------------------------
    if (isLateSubmission) {
      // Still save whatever answers were submitted so data isn't lost
      if (answers && answers.length > 0) {
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
          await supabase
            .rpc("upsert_student_answers", {
              p_attempt_module_id: attemptModuleId,
              p_answers: answersToSave,
            })
            .then(({ error }) => {
              if (error)
                console.error(
                  "[Grading] Late submission answer save failed:",
                  error,
                );
            });
        }
      }

      // Mark module as timeout so it cannot be resubmitted
      await supabase
        .from("attempt_modules")
        .update({
          status: "timeout",
          completed_at: new Date().toISOString(),
          time_remaining_seconds: 0,
        })
        .eq("id", attemptModuleId)
        .eq("status", attemptModule.status);

      return errorResponse(
        "Submission rejected: the time limit for this module has expired",
        403,
      );
    }

    // -------------------------------------------------------
    // 6. DEDUPLICATE SUBMITTED ANSWERS
    // -------------------------------------------------------
    const deduped = new Map<string, SubmittedAnswer>();
    if (answers && answers.length > 0) {
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
    }

    // -------------------------------------------------------
    // 7. WRITING MODULE — save only, no auto-grading
    // -------------------------------------------------------
    if (moduleType === "writing") {
      // Save submitted answers
      if (deduped.size > 0) {
        const answersToSave = Array.from(deduped.values())
          .filter((a) => a.reference_id && a.question_ref)
          .map((a) => ({
            reference_id: a.reference_id,
            question_ref: a.question_ref,
            student_response: a.student_response,
          }));

        if (answersToSave.length > 0) {
          const { error: upsertError } = await supabase.rpc(
            "upsert_student_answers",
            {
              p_attempt_module_id: attemptModuleId,
              p_answers: answersToSave,
            },
          );
          if (upsertError) {
            console.error(
              "[Grading] Writing answer upsert failed:",
              upsertError,
            );
            return errorResponse("Failed to save answers", 500);
          }
        }
      }

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
          time_remaining_seconds: serverTimeRemaining,
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
    // 8. FETCH QUESTIONS (single query via FK join)
    //    Replaces the two-step getModuleSubSectionIds + separate
    //    question_answers query with one PostgREST join.
    // -------------------------------------------------------
    const { data: moduleQuestions, error: questionsError } = await supabase
      .from("question_answers")
      .select(
        "id, sub_section_id, question_ref, correct_answers, options, marks, sub_sections!inner(id, sections!inner(module_id))",
      )
      .eq("sub_sections.sections.module_id", moduleId);

    if (questionsError) {
      console.error("[Grading] Failed to fetch questions:", questionsError);
      return errorResponse("Failed to load module questions", 500);
    }

    if (!moduleQuestions || moduleQuestions.length === 0) {
      return errorResponse("No questions found for this module", 500);
    }

    // Build question lookup
    const questionMap = new Map<string, QuestionAnswer>();
    let totalModuleMarks = 0;

    for (const q of moduleQuestions) {
      const key = `${q.sub_section_id}_${q.question_ref}`;
      questionMap.set(key, {
        id: q.id,
        sub_section_id: q.sub_section_id,
        question_ref: q.question_ref,
        correct_answers: q.correct_answers,
        options: q.options,
        explanation: null,
        marks: q.marks,
      } as QuestionAnswer);
      totalModuleMarks += q.marks || 1;
    }

    // -------------------------------------------------------
    // 9. UPSERT ALL ANSWERS (submitted + unattempted placeholders)
    //    - Merges submitted answers with placeholders for questions
    //      that have no student response, ensuring every question
    //      has a student_answers row for analytics & grading.
    //    - The RPC returns ALL answer rows with IDs, eliminating
    //      a separate read and avoiding read-after-write replica lag.
    // -------------------------------------------------------
    // Build the complete answer set: submitted + placeholders for unattempted
    const completeAnswers = new Map<string, SubmittedAnswer>();

    // Start with submitted answers (already deduplicated)
    for (const [key, ans] of deduped) {
      completeAnswers.set(key, ans);
    }

    // Add empty placeholders for unattempted questions
    for (const [key, question] of questionMap) {
      if (!completeAnswers.has(key)) {
        completeAnswers.set(key, {
          reference_id: question.sub_section_id,
          question_ref: question.question_ref,
          student_response: "",
        });
      }
    }

    const answersToUpsert = Array.from(completeAnswers.values())
      .filter((a) => a.reference_id && a.question_ref)
      .map((a) => ({
        reference_id: a.reference_id,
        question_ref: a.question_ref,
        student_response: a.student_response,
      }));

    // Single RPC call: upserts answers and returns ALL rows with IDs
    // This eliminates the read-after-write pattern that could hit replica lag
    let allStudentAnswers: Array<{
      id: string;
      reference_id: string;
      question_ref: string;
      student_response: string | null;
    }> = [];

    if (answersToUpsert.length > 0) {
      const { data: upsertedRows, error: upsertError } = await supabase.rpc(
        "upsert_student_answers",
        {
          p_attempt_module_id: attemptModuleId,
          p_answers: answersToUpsert,
        },
      );

      if (upsertError) {
        console.error("[Grading] Answer upsert RPC failed:", upsertError);
        return errorResponse("Failed to save answers", 500);
      }

      allStudentAnswers = upsertedRows ?? [];
    }

    // Build student answer lookup from the RPC result (no separate DB read)
    const studentAnswerMap = new Map<
      string,
      { id: string; student_response: string }
    >();
    for (const sa of allStudentAnswers) {
      const key = `${sa.reference_id}_${sa.question_ref}`;
      studentAnswerMap.set(key, {
        id: sa.id,
        student_response: sa.student_response ?? "",
      });
    }

    // -------------------------------------------------------
    // 10. GRADE ANSWERS (Listening & Reading)
    // -------------------------------------------------------
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

      // Every question should have a student_answer row now (from upsert)
      // but handle edge case defensively
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

      // No correct answer defined — mark as incorrect (0 marks) and
      // push update so the row is not left in an ungraded state
      if (!question.correct_answers) {
        unansweredCount++;
        answerUpdates.push({
          id: studentAnswer.id,
          is_correct: false,
          marks_awarded: 0,
        });
        continue;
      }

      const result = validateAnswer(
        studentAnswer.student_response,
        question.correct_answers,
        questionMarks,
        question.options,
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
    // 11. CALCULATE BAND SCORE
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
    // 12. ATOMIC GRADING COMMIT (single RPC - all or nothing)
    // -------------------------------------------------------
    const { data: commitResult, error: commitError } = await supabase.rpc(
      "commit_grading_results",
      {
        p_attempt_module_id: attemptModuleId,
        p_total_score: totalScore,
        p_band_score: bandScore,
        p_time_spent: finalTimeSpent,
        p_time_remaining: serverTimeRemaining,
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

      // Handle concurrent modification gracefully
      if (commitError.message?.includes("CONCURRENT_MODIFICATION")) {
        return errorResponse(
          "This module has already been graded or status changed",
          409,
        );
      }

      return errorResponse("Failed to commit grading results", 500);
    }

    console.log(
      `[Grading] Atomic commit succeeded: ${commitResult?.answers_updated ?? 0} answers updated`,
    );

    // -------------------------------------------------------
    // 13. MODULE FLOW CONTROL (single RPC)
    // -------------------------------------------------------
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

    const nextModuleType = flowResult?.next_module_type ?? null;
    const attemptCompleted = flowResult?.attempt_completed ?? false;

    // -------------------------------------------------------
    // 14. RETURN RESULT
    // -------------------------------------------------------
    const elapsed = Date.now() - startTime;
    console.log(
      `[Grading v${GRADING_VERSION}] Module ${attemptModuleId} (${moduleType}) graded in ${elapsed}ms: ` +
        `${correctCount}/${moduleQuestions.length} correct, band ${bandScore}, ` +
        `next=${nextModuleType ?? "none"}, attemptDone=${attemptCompleted}`,
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
  } catch (error: unknown) {
    // Fix 8: Never expose internal error details to the client
    const msg =
      error instanceof Error ? error.message : "Unknown internal error";
    console.error("[Grading] Unexpected error:", msg);
    return errorResponse("An internal error occurred while grading", 500);
  }
}
