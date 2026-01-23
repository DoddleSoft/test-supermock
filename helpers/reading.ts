import { createClient } from "@/utils/supabase/client";

// Types based on database schema
export interface Question {
  question_id: string;
  passage_id: string;
  question_no: number;
  title: string;
  type: "blanks" | "mcq" | "boolean" | "essay" | "short_answer" | "note";
  options: any;
  correct_answer: any;
  marks: number;
  order_index: number;
  analyze: string | null;
}

export interface RenderBlock {
  type: "header" | "instruction" | "text" | "box" | "title" | "subtitle";
  content: string;
}

export interface Passage {
  passage_id: string;
  module_id?: string;
  title: string;
  heading: string | null;
  subheading?: string | null;
  passage_index?: number;
  instruction?: string | null;
  content_type?: "text" | "audio" | "image" | "video" | null;
  media_path?: string | null;
  passage_text: string;
  render_blocks: RenderBlock[];
  questions: Record<string, { answer: string; options?: string[] }>;
}

export interface ReadingModule {
  module_id: string;
  title: string;
  paper_id: string;
  module_type: "reading";
  center_id: string;
  order_index: number;
  duration_minutes: number;
  max_file_size_mb: number;
  passages: Passage[];
}

export interface Answer {
  question_id: string;
  answer: any;
  is_flagged?: boolean;
}

/**
 * Fetch complete reading module with all passages and questions
 */
export async function fetchReadingModule(
  moduleId: string,
): Promise<ReadingModule | null> {
  try {
    const supabase = createClient();

    // Fetch module details
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("*")
      .eq("module_id", moduleId)
      .eq("module_type", "reading")
      .single();

    if (moduleError || !module) {
      console.error("Error fetching module:", moduleError);
      return null;
    }

    // Fetch all passages for this module
    const { data: passages, error: passagesError } = await supabase
      .from("passages")
      .select("*")
      .eq("module_id", moduleId)
      .order("passage_index", { ascending: true });

    if (passagesError) {
      console.error("Error fetching passages:", passagesError);
      return null;
    }

    // Fetch all questions for each passage
    const passagesWithQuestions: Passage[] = await Promise.all(
      (passages || []).map(async (passage) => {
        const { data: questions, error: questionsError } = await supabase
          .from("questions")
          .select("*")
          .eq("passage_id", passage.passage_id)
          .order("order_index", { ascending: true });

        if (questionsError) {
          console.error("Error fetching questions:", questionsError);
          return { ...passage, questions: [] };
        }

        return {
          ...passage,
          questions: questions || [],
        };
      }),
    );

    return {
      ...module,
      passages: passagesWithQuestions,
    };
  } catch (error) {
    console.error("Error in fetchReadingModule:", error);
    return null;
  }
}

/**
 * Fetch reading module by paper ID
 */
export async function fetchReadingModuleByPaperId(
  paperId: string,
): Promise<ReadingModule | null> {
  try {
    const supabase = createClient();

    // Fetch reading module for this paper
    const { data: module, error: moduleError } = await supabase
      .from("modules")
      .select("*")
      .eq("paper_id", paperId)
      .eq("module_type", "reading")
      .single();

    if (moduleError || !module) {
      console.error("Error fetching module by paper ID:", moduleError);
      return null;
    }

    return fetchReadingModule(module.module_id);
  } catch (error) {
    console.error("Error in fetchReadingModuleByPaperId:", error);
    return null;
  }
}

/**
 * Calculate total questions across all passages
 */
export function getTotalQuestions(passages: Passage[]): number {
  return passages.reduce(
    (total, passage) => total + Object.keys(passage.questions).length,
    0,
  );
}

/**
 * Get question range for a specific passage (e.g., "1-13", "14-26")
 */
export function getQuestionRange(
  passages: Passage[],
  passageIndex: number,
): string {
  let startQuestion = 1;
  let endQuestion = 0;

  for (let i = 0; i < passages.length; i++) {
    const questionCount = Object.keys(passages[i].questions).length;
    endQuestion = startQuestion + questionCount - 1;

    if (i === passageIndex - 1) {
      return `${startQuestion}-${endQuestion}`;
    }

    startQuestion = endQuestion + 1;
  }

  return "";
}

/**
 * Get all answers for a specific passage
 */
export function getPassageAnswers(
  answers: Map<string, Answer>,
  passage: Passage,
): Answer[] {
  const questionIds = Object.keys(passage.questions);
  return questionIds
    .map((questionId) => answers.get(questionId))
    .filter((answer): answer is Answer => answer !== undefined);
}

/**
 * Check if all questions in a passage are answered
 */
export function isPassageComplete(
  answers: Map<string, Answer>,
  passage: Passage,
): boolean {
  const questionIds = Object.keys(passage.questions);
  return questionIds.every((questionId) => {
    const answer = answers.get(questionId);
    return answer && answer.answer !== null && answer.answer !== "";
  });
}

/**
 * Get completion percentage for the entire module
 */
export function getCompletionPercentage(
  answers: Map<string, Answer>,
  passages: Passage[],
): number {
  const totalQuestions = getTotalQuestions(passages);
  const answeredQuestions = Array.from(answers.values()).filter(
    (answer) => answer.answer !== null && answer.answer !== "",
  ).length;

  return totalQuestions > 0
    ? Math.round((answeredQuestions / totalQuestions) * 100)
    : 0;
}

/**
 * Get flagged questions count
 */
export function getFlaggedQuestionsCount(answers: Map<string, Answer>): number {
  return Array.from(answers.values()).filter((answer) => answer.is_flagged)
    .length;
}

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Validate answer based on question type
 */
export function validateAnswer(question: Question, answer: any): boolean {
  if (!answer) return false;

  switch (question.type) {
    case "blanks":
      return typeof answer === "string" && answer.trim().length > 0;
    case "mcq":
      return typeof answer === "string" && answer.trim().length > 0;
    case "boolean":
      return typeof answer === "boolean";
    case "short_answer":
      return typeof answer === "string" && answer.trim().length > 0;
    case "essay":
      return typeof answer === "string" && answer.trim().length > 0;
    default:
      return false;
  }
}

/**
 * Submit reading module answers
 */
export async function submitReadingAnswers(
  moduleId: string,
  userId: string,
  answers: Map<string, Answer>,
  timeSpent: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Convert Map to array for submission
    const answersArray = Array.from(answers.values());

    // Create submission record (adjust table name according to your schema)
    const { data, error } = await supabase.from("test_submissions").insert({
      module_id: moduleId,
      user_id: userId,
      answers: answersArray,
      time_spent_seconds: timeSpent,
      submitted_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error submitting answers:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in submitReadingAnswers:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get passage by index
 */
export function getPassageByIndex(
  passages: Passage[],
  index: number,
): Passage | null {
  return passages.find((p) => p.passage_index === index) || null;
}

/**
 * Get next passage
 */
export function getNextPassage(
  passages: Passage[],
  currentIndex: number,
): Passage | null {
  return passages.find((p) => p.passage_index === currentIndex + 1) || null;
}

/**
 * Get previous passage
 */
export function getPreviousPassage(
  passages: Passage[],
  currentIndex: number,
): Passage | null {
  return passages.find((p) => p.passage_index === currentIndex - 1) || null;
}
