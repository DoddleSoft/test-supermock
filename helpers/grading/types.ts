// ============================================================
// TYPE DEFINITIONS FOR GRADING ENGINE
// ============================================================

export interface GradingRequest {
  attemptModuleId: string;
  answers?: SubmittedAnswer[];
  autoSubmit?: boolean;
  timeSpentSeconds?: number;
  timeRemainingSeconds?: number;
}

export interface SubmittedAnswer {
  reference_id: string;
  question_ref: string;
  student_response: string;
}

export interface QuestionAnswer {
  id: string;
  sub_section_id: string;
  question_ref: string;
  correct_answers: any;
  options: any;
  explanation: string | null;
  marks: number;
}

export interface GradingResult {
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

export interface AnswerUpdate {
  id: string;
  is_correct: boolean;
  marks_awarded: number;
}
