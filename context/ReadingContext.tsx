"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import {
  ReadingModule,
  Passage,
  Question,
  Answer,
  fetchReadingModule,
  getTotalQuestions,
  getQuestionRange,
  isPassageComplete,
  getCompletionPercentage,
  getFlaggedQuestionsCount,
  formatTime,
  validateAnswer,
  submitReadingAnswers,
  getPassageByIndex,
  getNextPassage,
  getPreviousPassage,
} from "@/helpers/reading";

interface ReadingContextType {
  // Module data
  module: ReadingModule | null;
  isLoading: boolean;
  error: string | null;

  // Current state
  currentPassageIndex: number;
  currentPassage: Passage | null;
  selectedPassageIndex: number | null;

  // Timer
  timeLeft: number;
  isStarted: boolean;

  // Answers
  answers: Map<string, Answer>;

  // Actions
  loadModule: (moduleId: string) => Promise<void>;
  setCurrentPassageIndex: (index: number) => void;
  setSelectedPassageIndex: (index: number | null) => void;
  startTest: () => void;
  submitAnswer: (questionId: string, answer: any) => void;
  toggleFlag: (questionId: string) => void;
  goToNextPassage: () => void;
  goToPreviousPassage: () => void;
  submitTest: (userId: string) => Promise<{ success: boolean; error?: string }>;

  // Computed values
  totalQuestions: number;
  completionPercentage: number;
  flaggedCount: number;
  formattedTime: string;
}

const ReadingContext = createContext<ReadingContextType | undefined>(undefined);

export function ReadingProvider({ children }: { children: React.ReactNode }) {
  // Module data
  const [module, setModule] = useState<ReadingModule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Current state
  const [currentPassageIndex, setCurrentPassageIndexState] = useState(1);
  const [selectedPassageIndex, setSelectedPassageIndex] = useState<
    number | null
  >(1);

  // Timer
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes default
  const [isStarted, setIsStarted] = useState(false);

  // Answers
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());

  // Load module data
  const loadModule = useCallback(async (moduleId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const moduleData = await fetchReadingModule(moduleId);

      if (!moduleData) {
        setError("Failed to load reading module");
        return;
      }

      setModule(moduleData);
      setTimeLeft(moduleData.duration_minutes * 60);

      // Initialize answers map for all questions
      const initialAnswers = new Map<string, Answer>();
      moduleData.passages.forEach((passage) => {
        Object.keys(passage.questions).forEach((questionId) => {
          initialAnswers.set(questionId, {
            question_id: questionId,
            answer: null,
            is_flagged: false,
          });
        });
      });
      setAnswers(initialAnswers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set current passage
  const setCurrentPassageIndex = useCallback(
    (index: number) => {
      if (!module) return;

      const passage = getPassageByIndex(module.passages, index);
      if (passage) {
        setCurrentPassageIndexState(index);
      }
    },
    [module]
  );

  // Start test
  const startTest = useCallback(() => {
    setIsStarted(true);

    // Start timer countdown
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup on unmount
    return () => clearInterval(timer);
  }, []);

  // Submit answer
  const submitAnswer = useCallback((questionId: string, answer: any) => {
    setAnswers((prev) => {
      const newAnswers = new Map(prev);
      const existingAnswer = newAnswers.get(questionId);

      newAnswers.set(questionId, {
        question_id: questionId,
        answer,
        is_flagged: existingAnswer?.is_flagged || false,
      });

      return newAnswers;
    });
  }, []);

  // Toggle flag
  const toggleFlag = useCallback((questionId: string) => {
    setAnswers((prev) => {
      const newAnswers = new Map(prev);
      const existingAnswer = newAnswers.get(questionId);

      if (existingAnswer) {
        newAnswers.set(questionId, {
          ...existingAnswer,
          is_flagged: !existingAnswer.is_flagged,
        });
      }

      return newAnswers;
    });
  }, []);

  // Navigation
  const goToNextPassage = useCallback(() => {
    if (!module) return;

    const nextPassage = getNextPassage(module.passages, currentPassageIndex);
    if (nextPassage && nextPassage.passage_index !== undefined) {
      setCurrentPassageIndexState(nextPassage.passage_index);
    }
  }, [module, currentPassageIndex]);

  const goToPreviousPassage = useCallback(() => {
    if (!module) return;

    const prevPassage = getPreviousPassage(
      module.passages,
      currentPassageIndex
    );
    if (prevPassage && prevPassage.passage_index !== undefined) {
      setCurrentPassageIndexState(prevPassage.passage_index);
    }
  }, [module, currentPassageIndex]);

  // Submit test
  const submitTest = useCallback(
    async (userId: string) => {
      if (!module) {
        return { success: false, error: "No module loaded" };
      }

      const timeSpent = module.duration_minutes * 60 - timeLeft;
      return submitReadingAnswers(module.module_id, userId, answers, timeSpent);
    },
    [module, answers, timeLeft]
  );

  // Computed values
  const currentPassage = module
    ? getPassageByIndex(module.passages, currentPassageIndex)
    : null;

  const totalQuestions = module ? getTotalQuestions(module.passages) : 0;

  const completionPercentage = module
    ? getCompletionPercentage(answers, module.passages)
    : 0;

  const flaggedCount = getFlaggedQuestionsCount(answers);

  const formattedTime = formatTime(timeLeft);

  const value: ReadingContextType = {
    // Module data
    module,
    isLoading,
    error,

    // Current state
    currentPassageIndex,
    currentPassage,
    selectedPassageIndex,

    // Timer
    timeLeft,
    isStarted,

    // Answers
    answers,

    // Actions
    loadModule,
    setCurrentPassageIndex,
    setSelectedPassageIndex,
    startTest,
    submitAnswer,
    toggleFlag,
    goToNextPassage,
    goToPreviousPassage,
    submitTest,

    // Computed values
    totalQuestions,
    completionPercentage,
    flaggedCount,
    formattedTime,
  };

  return (
    <ReadingContext.Provider value={value}>{children}</ReadingContext.Provider>
  );
}

export function useReading() {
  const context = useContext(ReadingContext);
  if (context === undefined) {
    throw new Error("useReading must be used within a ReadingProvider");
  }
  return context;
}
