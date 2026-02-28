"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useExam } from "@/context/ExamContext";
import { toast } from "sonner";
import RenderBlock from "@/component/modules/RenderBlock";
import { Loader } from "@/component/ui/loader";
import ReadingNavbar from "@/component/modules/ReadingNavbar";
import {
  getModuleAnswersFromStorage,
  updateAnswerInStorage,
} from "@/utils/answerStorage";
import { syncStoredAnswersToDatabase } from "@/helpers/answerSync";
import { buildBlocks, buildPassageBlocks } from "@/helpers/contentBlocks";

interface ReadingTestClientProps {
  attemptId: string;
  centerSlug: string;
  moduleId: string;
}

export default function ReadingTestClient({
  attemptId,
  centerSlug,
  moduleId,
}: ReadingTestClientProps) {
  const router = useRouter();
  const {
    modules,
    currentModule,
    sections,
    subSections,
    questionAnswers,
    answers,
    timeLeft,
    currentSectionIndex,
    loadModule,
    submitAnswer,
    setCurrentSection,
    submitModule,
    isLoading,
    showSubmitDialog,
    submitDialogMessage,
    dismissSubmitDialog,
    getNextModuleUrl,
    currentAttemptModule,
  } = useExam();

  const [moduleLoaded, setModuleLoaded] = useState(false);
  const localAnswersRef = useRef<Record<string, string>>({});
  const moduleLoadInProgress = useRef(false);

  // Handle auto-submit dialog
  // Handle auto-submit dialog → navigate to waiting room
  useEffect(() => {
    if (showSubmitDialog && submitDialogMessage) {
      const timer = setTimeout(() => {
        dismissSubmitDialog();
        router.push(`/mock-test/${centerSlug}/${attemptId}`);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [
    showSubmitDialog,
    submitDialogMessage,
    dismissSubmitDialog,
    router,
    centerSlug,
    attemptId,
  ]);

  // Load the reading module on mount
  useEffect(() => {
    if (moduleLoaded || moduleLoadInProgress.current) return;
    if (modules.length === 0) return;

    const readingModule = modules.find((m) => m.module_type === "reading");
    if (!readingModule) {
      toast.error("Reading module not found");
      return;
    }

    // Check if module is already loaded
    if (currentModule && currentModule.id === readingModule.id) {
      setModuleLoaded(true);
      return;
    }

    moduleLoadInProgress.current = true;
    loadModule(readingModule.id)
      .then(() => {
        setModuleLoaded(true);
        // Load answers from localStorage
        if (attemptId) {
          const storedAnswers = getModuleAnswersFromStorage(
            attemptId,
            "reading",
          );

          // Build valid question set from current module
          const validQuestions = new Set(
            questionAnswers.map((qa) => qa.question_ref),
          );

          const answerMap: Record<string, string> = {};
          storedAnswers.forEach((a) => {
            // Only load answers for questions that exist in current module
            if (validQuestions.has(a.questionRef)) {
              const key = `${a.referenceId}_${a.questionRef}`;
              answerMap[key] = a.studentResponse;
              // Submit to context
              submitAnswer(a.questionRef, a.referenceId, a.studentResponse);
            }
          });
          localAnswersRef.current = answerMap;
        }
      })
      .catch((error) => {
        console.error("Load reading module error:", error);
        toast.error("Failed to load reading module");
      })
      .finally(() => {
        moduleLoadInProgress.current = false;
      });
  }, [modules, currentModule]);

  const currentSection = sections[currentSectionIndex];
  const sectionSubSections = subSections.filter(
    (ss) => ss.section_id === currentSection?.id,
  );
  const sectionQuestions = questionAnswers.filter((qa) =>
    sectionSubSections.some((ss) => ss.id === qa.sub_section_id),
  );

  const questionToSubSection = useMemo(() => {
    const map: Record<string, string> = {};
    // Use ALL questionAnswers to ensure we have mappings for every question
    questionAnswers.forEach((qa) => {
      map[qa.question_ref] = qa.sub_section_id;
    });
    return map;
  }, [questionAnswers]);

  const questionMap = useMemo(() => {
    const map: Record<string, { answer: string; options?: any[] }> = {};
    // Use ALL questionAnswers to ensure all questions have options/config
    questionAnswers.forEach((qa) => {
      map[qa.question_ref] = {
        answer: "",
        options: qa.options ?? [],
      };
    });
    return map;
  }, [questionAnswers]);

  const answerMap = useMemo(() => {
    const map: Record<string, string> = {};
    // Include ALL answers, not just current section
    answers.forEach((value) => {
      const response = Array.isArray(value.student_response)
        ? value.student_response.join(", ")
        : value.student_response;
      map[value.question_ref] = response ?? "";
    });
    return map;
  }, [answers]);

  const handleAnswerChange = (questionRef: string, value: string) => {
    const subSectionId = questionToSubSection[questionRef];

    if (!subSectionId) {
      console.warn(`No subsection mapping for question ${questionRef}`);
      return;
    }

    submitAnswer(questionRef, subSectionId, value);

    // Save to localStorage
    if (attemptId && currentModule?.id) {
      updateAnswerInStorage(attemptId, currentModule.id, {
        questionRef,
        referenceId: subSectionId,
        studentResponse: value,
        moduleType: "reading",
        timestamp: Date.now(),
      });

      const key = `${subSectionId}_${questionRef}`;
      localAnswersRef.current[key] = value;
    }
  };

  // Ctrl+S save functionality
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!currentAttemptModule?.id || !attemptId) return;

        toast.promise(
          syncStoredAnswersToDatabase(attemptId, currentAttemptModule.id),
          {
            loading: "Saving answers...",
            success: (result) => `Saved ${result.savedCount} answers`,
            error: "Failed to save answers",
          },
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentAttemptModule, attemptId]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle submit - matches listening module logic
  const handleSubmit = async () => {
    if (!currentAttemptModule?.id) {
      toast.error("No active module to submit");
      return;
    }

    setIsSubmitting(true);

    // First sync local storage to database
    if (attemptId) {
      await syncStoredAnswersToDatabase(attemptId, currentAttemptModule.id);
    }

    toast.promise(submitModule(), {
      loading: "Submitting your answers...",
      success: (result) => {
        if (result.success) {
          setTimeout(() => {
            router.push(`/mock-test/${centerSlug}/${attemptId}`);
          }, 1500);
          return `Module submitted successfully!`;
        }
        return "Submission completed";
      },
      error: (err) => {
        setIsSubmitting(false);
        return `Submission failed: ${err}`;
      },
    });
  };

  if (isLoading || !currentModule) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Full-screen loading overlay during submission */}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-semibold text-gray-900">
              Please wait while we load other modules...
            </p>
            <p className="text-sm text-gray-600">Do not close this window</p>
          </div>
        </div>
      )}

      <ReadingNavbar
        timeLeft={timeLeft}
        questions={
          sectionQuestions.length
            ? `${sectionQuestions[0].question_ref}-${sectionQuestions[sectionQuestions.length - 1].question_ref}`
            : undefined
        }
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <main className="mx-auto max-w-7xl pt-28 px-4">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* left side */}
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-md bg-white shadow-sm border border-gray-100">
            <div className="border-b border-gray-200 px-4 py-2">
              <h2 className="mb-2 text-sm text-gray-900">
                {currentSection?.title || "Reading Passage"}
              </h2>
              {currentSection?.subtext && (
                <h3 className="text-lg font-semibold text-gray-800">
                  {currentSection.subtext}
                </h3>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="prose prose-zinc max-w-none text-gray-700">
                {currentSection?.content_text
                  ? buildPassageBlocks(currentSection.content_text).map(
                      (block, idx) => (
                        <RenderBlock
                          key={`passage-${idx}`}
                          block={block}
                          theme="green"
                        />
                      ),
                    )
                  : sectionSubSections.map((subSection) => (
                      <div key={subSection.id} className="mb-6">
                        {subSection.boundary_text && (
                          <h3 className="text-lg font-semibold text-gray-800 mb-3">
                            {subSection.boundary_text}
                          </h3>
                        )}
                        {buildPassageBlocks(subSection.content_template).map(
                          (block, idx) => (
                            <RenderBlock
                              key={`${subSection.id}-passage-${idx}`}
                              block={block}
                              theme="green"
                            />
                          ),
                        )}
                      </div>
                    ))}
              </div>
            </div>
          </div>

          {/* right side */}
          <div className="flex h-[calc(100vh-200px)] flex-col bg-white">
            {currentSection?.instruction && (
              <p className="text-xs text-gray-900 mb-2 bg-red-200 p-2 rounded text-center font-medium">
                {currentSection.instruction}
              </p>
            )}
            <div className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="space-y-6 mt-4">
                {sectionSubSections.map((subSection) => {
                  const blocks = buildBlocks(
                    subSection.content_template ?? "",
                    subSection.sub_type ?? null,
                    subSection.instruction ?? null,
                  );

                  return (
                    <div key={subSection.id} className="space-y-2">
                      {subSection.boundary_text && (
                        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          {subSection.boundary_text}
                        </h4>
                      )}

                      {blocks.map((block, idx) => (
                        <RenderBlock
                          key={`${subSection.id}-${idx}`}
                          block={block}
                          theme="green"
                          questions={questionMap}
                          answers={answerMap}
                          onAnswerChange={handleAnswerChange}
                          showQuestionNumbers
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() =>
                setCurrentSection(Math.max(0, currentSectionIndex - 1))
              }
              disabled={currentSectionIndex === 0}
              className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <div className="flex gap-3">
              {sections.map((section, idx) => (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(idx)}
                  className={`h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                    idx === currentSectionIndex
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() =>
                setCurrentSection(
                  Math.min(sections.length - 1, currentSectionIndex + 1),
                )
              }
              disabled={currentSectionIndex === sections.length - 1}
              className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showSubmitDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Submitted Successfully
              </h3>
              <p className="text-gray-600 mb-6">
                {submitDialogMessage ||
                  "Your answers have been submitted for evaluation."}
              </p>
              <p className="text-sm text-gray-500">
                Redirecting to next module...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
