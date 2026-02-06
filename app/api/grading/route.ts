import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// ============================================================
// GRADING ENGINE v2.0.0
// Industry-grade IELTS grading API
// Atomic, idempotent, secure, cheat-resistant
// ============================================================

const GRADING_VERSION = "2.0.0";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface GradingRequest {
  attemptModuleId: string;
  answers?: SubmittedAnswer[];
  autoSubmit?: boolean;
  timeSpentSeconds?: number;
  timeRemainingSeconds?: number;
}

interface SubmittedAnswer {
  reference_id: string;
  question_ref: string;
  student_response: string;
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

interface GradingResult {
  success: boolean;
  totalScore?: number;
  maxScore?: number;
  bandScore?: number | null;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  percentage?: number;
  nextModuleType?: string | null;
  attemptCompleted?: boolean;
  alreadyGraded?: boolean;
  error?: string;
  gradingVersion?: string;
}

// ============================================================
// NUMBER ↔ WORD NORMALIZATION MAP
// ============================================================

const NUMBER_WORD_TO_DIGIT: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
  thousand: "1000",
  first: "1st",
  second: "2nd",
  third: "3rd",
  fourth: "4th",
  fifth: "5th",
  sixth: "6th",
  seventh: "7th",
  eighth: "8th",
  ninth: "9th",
  tenth: "10th",
};

// Build reverse map: digit → word
const DIGIT_TO_NUMBER_WORD: Record<string, string> = {};
for (const [word, digit] of Object.entries(NUMBER_WORD_TO_DIGIT)) {
  DIGIT_TO_NUMBER_WORD[digit] = word;
}

// Compound numbers like "twenty one" → "21", "twenty-one" → "21"
const COMPOUND_NUMBER_WORDS: Record<string, string> = {};
const TENS = [
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];
const ONES = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];
for (const ten of TENS) {
  const tenVal = parseInt(NUMBER_WORD_TO_DIGIT[ten]);
  for (const one of ONES) {
    const oneVal = parseInt(NUMBER_WORD_TO_DIGIT[one]);
    const total = (tenVal + oneVal).toString();
    COMPOUND_NUMBER_WORDS[`${ten} ${one}`] = total;
    COMPOUND_NUMBER_WORDS[`${ten}-${one}`] = total;
    COMPOUND_NUMBER_WORDS[`${ten}${one}`] = total;
  }
}

// ============================================================
// TEXT NORMALIZATION ENGINE
// ============================================================

/**
 * Core text normalization for IELTS answer comparison.
 * 1. Lowercase
 * 2. Trim + collapse whitespace
 * 3. Normalize hyphens to spaces
 * 4. Remove punctuation (except internal apostrophes)
 * 5. Convert number words to digits
 * 6. Normalize common plurals
 */
function normalizeText(text: string): string {
  if (!text || typeof text !== "string") return "";

  let result = text.toLowerCase().trim();

  // Replace hyphens with spaces for uniform comparison
  result = result.replace(/-/g, " ");

  // Remove punctuation except apostrophes within words (e.g., don't, it's)
  result = result.replace(/[^\w\s']/g, "");

  // Collapse multiple spaces
  result = result.replace(/\s+/g, " ").trim();

  // Convert compound number words first (before single words)
  for (const [compound, digit] of Object.entries(COMPOUND_NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${compound}\\b`, "gi");
    result = result.replace(regex, digit);
  }

  // Convert single number words to digits
  for (const [word, digit] of Object.entries(NUMBER_WORD_TO_DIGIT)) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, digit);
  }

  // Final whitespace cleanup
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

/**
 * Generate normalized variants for flexible matching.
 * Returns the base normalization plus singular/plural variants.
 */
function getNormalizedVariants(text: string): string[] {
  const base = normalizeText(text);
  if (!base) return [];

  const variants = new Set<string>();
  variants.add(base);

  // Singular/plural variants
  if (base.endsWith("ies")) {
    // 'ies' → 'y' (e.g., "countries" → "country")
    variants.add(base.slice(0, -3) + "y");
  } else if (base.endsWith("ves")) {
    // 'ves' → 'f' (e.g., "knives" → "knife")
    variants.add(base.slice(0, -3) + "f");
    variants.add(base.slice(0, -3) + "fe");
  } else if (base.endsWith("es")) {
    // 'es' → '' (e.g., "boxes" → "box")
    variants.add(base.slice(0, -2));
  } else if (base.endsWith("s") && !base.endsWith("ss")) {
    // 's' → '' (e.g., "cats" → "cat")
    variants.add(base.slice(0, -1));
  }

  // Add with 's' if doesn't end with 's'
  if (!base.endsWith("s")) {
    variants.add(base + "s");
  }

  // Digit ↔ word variants for the entire base if it's a pure number/word
  if (DIGIT_TO_NUMBER_WORD[base]) {
    variants.add(DIGIT_TO_NUMBER_WORD[base]);
  }
  if (NUMBER_WORD_TO_DIGIT[base]) {
    variants.add(NUMBER_WORD_TO_DIGIT[base]);
  }

  // Hyphen ↔ space variants (add the hyphenated form back)
  if (base.includes(" ")) {
    variants.add(base.replace(/ /g, "-"));
  }

  return Array.from(variants);
}

// ============================================================
// LEVENSHTEIN DISTANCE (FUZZY MATCHING)
// ============================================================

/**
 * Calculate Levenshtein edit distance between two strings.
 * Optimized: early exit if distance already > 1.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // If length difference > 1, distance must be > 1
  if (Math.abs(a.length - b.length) > 1) return 2;

  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

// ============================================================
// ANSWER MATCHING ENGINE
// ============================================================

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
function matchSingleAnswer(student: string, correct: string): boolean {
  const studentVariants = getNormalizedVariants(student);
  const correctVariants = getNormalizedVariants(correct);

  // Exact match across all variant combinations
  for (const sv of studentVariants) {
    for (const cv of correctVariants) {
      if (matchWithArticles(sv, cv)) return true;
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
function validateAnswer(
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
      if (isCorrect) return { isCorrect: true, marksAwarded: marks };
    }

    return { isCorrect: false, marksAwarded: 0 };
  }

  // Check against simple string
  const isCorrect = matchSingleAnswer(trimmed, String(correctAnswers));
  return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
}

// ============================================================
// OFFICIAL IELTS BAND SCORE CONVERSION TABLES
// ============================================================

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

/**
 * Convert raw score to IELTS band using official lookup tables.
 * Returns null for writing/speaking (manually graded).
 */
function calculateBandScore(
  rawScore: number,
  moduleType: string,
): number | null {
  if (moduleType !== "reading" && moduleType !== "listening") return null;

  const score = Math.max(0, Math.min(40, Math.floor(rawScore)));
  const table =
    moduleType === "listening" ? IELTS_LISTENING_BANDS : IELTS_READING_BANDS;

  return table[score] ?? 1.0;
}

// ============================================================
// MODULE ORDER & FLOW CONTROL
// ============================================================

const MODULE_ORDER = ["listening", "reading", "writing"] as const;

function getNextModuleType(currentType: string): string | null {
  const idx = MODULE_ORDER.indexOf(
    currentType as (typeof MODULE_ORDER)[number],
  );
  if (idx === -1 || idx >= MODULE_ORDER.length - 1) return null;
  return MODULE_ORDER[idx + 1];
}

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
      // Already graded — determine next module for navigation
      const flowResult = await handleModuleFlowControl(
        supabase,
        attemptModule.attempt_id,
        moduleType,
      );

      return NextResponse.json({
        success: true,
        alreadyGraded: true,
        totalScore: attemptModule.score_obtained ?? 0,
        bandScore: attemptModule.band_score ?? null,
        nextModuleType: flowResult.nextModuleType,
        attemptCompleted: flowResult.attemptCompleted,
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
    // 6. SAVE ANSWERS (upsert, idempotent via unique constraint)
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
          attempt_module_id: attemptModuleId,
          reference_id: a.reference_id,
          question_ref: a.question_ref,
          student_response: a.student_response,
        }));

      if (answersToSave.length > 0) {
        const { error: upsertError } = await supabase
          .from("student_answers")
          .upsert(answersToSave, {
            onConflict: "attempt_module_id,reference_id,question_ref",
          });

        if (upsertError) {
          console.error("[Grading] Answer upsert failed:", upsertError);
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

      const flowResult = await handleModuleFlowControl(
        supabase,
        attemptModule.attempt_id,
        moduleType,
      );

      return NextResponse.json({
        success: true,
        bandScore: null,
        nextModuleType: flowResult.nextModuleType,
        attemptCompleted: flowResult.attemptCompleted,
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
    // 10. STORE GRADING RESULTS (per-answer)
    // -------------------------------------------------------
    if (answerUpdates.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < answerUpdates.length; i += BATCH_SIZE) {
        const batch = answerUpdates.slice(i, i + BATCH_SIZE);
        const updatePromises = batch.map((upd) =>
          supabase
            .from("student_answers")
            .update({
              is_correct: upd.is_correct,
              marks_awarded: upd.marks_awarded,
            })
            .eq("id", upd.id),
        );
        const results = await Promise.all(updatePromises);
        for (const r of results) {
          if (r.error) {
            console.error("[Grading] Answer update error:", r.error);
          }
        }
      }
    }

    // -------------------------------------------------------
    // 11. CALCULATE BAND SCORE & UPDATE MODULE
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

    // Optimistic lock: only update if status hasn't changed concurrently
    const { error: moduleUpdateError } = await supabase
      .from("attempt_modules")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        score_obtained: totalScore,
        band_score: bandScore,
        time_spent_seconds: finalTimeSpent,
        time_remaining_seconds: timeRemainingSeconds ?? 0,
      })
      .eq("id", attemptModuleId)
      .eq("status", attemptModule.status); // Concurrency lock

    if (moduleUpdateError) {
      console.error("[Grading] Module update failed:", moduleUpdateError);
      return errorResponse(
        `Failed to update module: ${moduleUpdateError.message}`,
        500,
      );
    }

    // -------------------------------------------------------
    // 12. MODULE FLOW CONTROL
    // -------------------------------------------------------
    const flowResult = await handleModuleFlowControl(
      supabase,
      attemptModule.attempt_id,
      moduleType,
    );

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
      nextModuleType: flowResult.nextModuleType,
      attemptCompleted: flowResult.attemptCompleted,
      alreadyGraded: false,
      gradingVersion: GRADING_VERSION,
    } satisfies GradingResult);
  } catch (error: any) {
    console.error("[Grading] Unexpected error:", error);
    return errorResponse(error?.message || "Internal grading error", 500);
  }
}

// ============================================================
// HELPER: Get all sub_section IDs for a module
// ============================================================

async function getModuleSubSectionIds(
  supabase: any,
  moduleId: string,
): Promise<string[]> {
  const { data: sections, error: sectionsError } = await supabase
    .from("sections")
    .select("id")
    .eq("module_id", moduleId);

  if (sectionsError || !sections || sections.length === 0) {
    return [];
  }

  const sectionIds = sections.map((s: any) => s.id);

  const { data: subSections, error: subError } = await supabase
    .from("sub_sections")
    .select("id")
    .in("section_id", sectionIds);

  if (subError || !subSections) {
    return [];
  }

  return subSections.map((ss: any) => ss.id);
}

// ============================================================
// HELPER: Compute final time spent
// ============================================================

function computeFinalTimeSpent(
  startedAt: string | null,
  previousTimeSpent: number | null,
  clientTimeSpent?: number,
): number {
  if (clientTimeSpent !== undefined && clientTimeSpent > 0) {
    return clientTimeSpent;
  }

  const prev = previousTimeSpent || 0;

  if (startedAt) {
    const startMs = new Date(startedAt).getTime();
    const additionalSeconds = Math.max(
      0,
      Math.floor((Date.now() - startMs) / 1000),
    );
    return prev + additionalSeconds;
  }

  return prev;
}

// ============================================================
// HELPER: Module Flow Control
// ============================================================

interface FlowResult {
  nextModuleType: string | null;
  attemptCompleted: boolean;
}

async function handleModuleFlowControl(
  supabase: any,
  attemptId: string,
  currentModuleType: string,
): Promise<FlowResult> {
  try {
    // Get all attempt modules for this attempt
    const { data: allModules, error: modulesError } = await supabase
      .from("attempt_modules")
      .select(
        "id, module_id, status, band_score, score_obtained, modules(module_type)",
      )
      .eq("attempt_id", attemptId);

    if (modulesError || !allModules) {
      return { nextModuleType: null, attemptCompleted: false };
    }

    const completedModules = allModules.filter(
      (m: any) => m.status === "completed",
    );

    // All modules completed → lock attempt
    if (completedModules.length === allModules.length) {
      const validScores = completedModules
        .filter((m: any) => m.band_score !== null && m.band_score !== undefined)
        .map((m: any) => parseFloat(m.band_score));

      let overallBandScore: number | null = null;
      if (validScores.length > 0) {
        const avg =
          validScores.reduce((sum: number, s: number) => sum + s, 0) /
          validScores.length;
        overallBandScore = Math.round(avg * 2) / 2;
      }

      // Lock attempt — optimistic: only if still in_progress
      await supabase
        .from("mock_attempts")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          overall_band_score: overallBandScore,
        })
        .eq("id", attemptId)
        .eq("status", "in_progress");

      return { nextModuleType: null, attemptCompleted: true };
    }

    // Determine next module in sequence
    const nextType = getNextModuleType(currentModuleType);
    if (nextType) {
      const nextModule = allModules.find(
        (m: any) =>
          (m as any).modules?.module_type === nextType &&
          m.status !== "completed",
      );
      if (nextModule) {
        return { nextModuleType: nextType, attemptCompleted: false };
      }
    }

    // Fallback: find any non-completed module
    const anyPending = allModules.find((m: any) => m.status !== "completed");
    if (anyPending) {
      return {
        nextModuleType: (anyPending as any).modules?.module_type || null,
        attemptCompleted: false,
      };
    }

    return { nextModuleType: null, attemptCompleted: true };
  } catch (error) {
    console.error("[Grading] Flow control error:", error);
    return { nextModuleType: null, attemptCompleted: false };
  }
}

// ============================================================
// HELPER: Standard error response
// ============================================================

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      gradingVersion: GRADING_VERSION,
    },
    { status },
  );
}
