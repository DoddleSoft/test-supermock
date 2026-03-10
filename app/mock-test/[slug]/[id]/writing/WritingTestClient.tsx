"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import WritingNavbar from "@/component/modules/WritingNavbar";
import { useExam } from "@/context/ExamContext";
import {
  updateAnswerInStorage,
  getModuleAnswersFromStorage,
} from "@/utils/answerStorage";
import { syncStoredAnswersToDatabase } from "@/helpers/answerSync";
import Image from "next/image";

interface WritingTestClientProps {
  slug: string;
}

export default function WritingTestClient({ slug }: WritingTestClientProps) {
  const router = useRouter();
  const {
    modules,
    currentModule,
    sections,
    subSections,
    timeLeft,
    currentSectionIndex,
    setCurrentSection,
    loadModule,
    submitAnswer,
    attemptId,
    currentAttemptModule,
    submitModule,
    showSubmitDialog,
    submitDialogMessage,
    dismissSubmitDialog,
  } = useExam();

  const [moduleLoaded, setModuleLoaded] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const submitRedirectTimer = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitRedirectTimer = useRef<NodeJS.Timeout | null>(null);
  // Debounce timer for localStorage writes
  const storageDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Keep latest answers in a ref so the debounced callback always sees fresh data
  const pendingStorageRef = useRef<{
    sectionId: string;
    value: string;
    essayNumber: number;
  } | null>(null);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (submitRedirectTimer.current)
        clearTimeout(submitRedirectTimer.current);
      if (autoSubmitRedirectTimer.current)
        clearTimeout(autoSubmitRedirectTimer.current);
      if (storageDebounceRef.current) clearTimeout(storageDebounceRef.current);
    };
  }, []);

  // Load the writing module on mount
  useEffect(() => {
    if (moduleLoaded) return;
    if (modules.length === 0) return;

    const writingModule = modules.find((m) => m.module_type === "writing");
    if (!writingModule) {
      toast.error("Writing module not found");
      return;
    }

    loadModule(writingModule.id)
      .then(() => {
        setModuleLoaded(true);
        // Load answers from localStorage
        if (attemptId) {
          const storedAnswers = getModuleAnswersFromStorage(
            attemptId,
            "writing",
          );
          const answerMap: Record<string, string> = {};
          storedAnswers.forEach((a) => {
            answerMap[a.referenceId] = a.studentResponse;
            // Sync to ExamContext so global state is consistent
            submitAnswer(a.questionRef, a.referenceId, a.studentResponse);
          });
          setAnswers(answerMap);
        }
      })
      .catch((error) => {
        console.error("Load writing module error:", error);
        toast.error("Failed to load writing module");
      });
  }, [modules, loadModule, moduleLoaded, attemptId]);

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

  // Periodic auto-save to database every 60 seconds
  useEffect(() => {
    if (!currentAttemptModule?.id || !attemptId) return;
    const amId = currentAttemptModule.id;

    const interval = setInterval(() => {
      syncStoredAnswersToDatabase(attemptId, amId).catch((err) =>
        console.error("Auto-save failed:", err),
      );
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [currentAttemptModule?.id, attemptId]);

  // Handle auto-submit dialog → navigate to waiting room
  useEffect(() => {
    if (showSubmitDialog && submitDialogMessage) {
      setIsSubmitting(true);
      autoSubmitRedirectTimer.current = setTimeout(() => {
        dismissSubmitDialog();
        router.push(`/mock-test/${slug}/${attemptId}`);
      }, 3000);
      return () => {
        if (autoSubmitRedirectTimer.current)
          clearTimeout(autoSubmitRedirectTimer.current);
      };
    }
  }, [
    showSubmitDialog,
    submitDialogMessage,
    dismissSubmitDialog,
    router,
    slug,
    attemptId,
  ]);

  const currentSection = sections[currentSectionIndex];

  // Flush any pending debounced storage write immediately
  const flushPendingStorage = useCallback(() => {
    if (storageDebounceRef.current) {
      clearTimeout(storageDebounceRef.current);
      storageDebounceRef.current = null;
    }
    const pending = pendingStorageRef.current;
    if (pending && attemptId && currentModule?.id) {
      updateAnswerInStorage(attemptId, currentModule.id, {
        questionRef: `essay ${pending.essayNumber}`,
        referenceId: pending.sectionId,
        studentResponse: pending.value,
        moduleType: "writing",
        timestamp: Date.now(),
      });
      pendingStorageRef.current = null;
    }
  }, [attemptId, currentModule?.id]);

  const handleAnswerChange = (sectionId: string, value: string) => {
    // 1. Update React state instantly — typing stays smooth
    setAnswers((prev) => ({ ...prev, [sectionId]: value }));

    // 2. Word count (lightweight regex — negligible at 200 words)
    const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
    setWordCounts((prev) => ({ ...prev, [sectionId]: wordCount }));

    // 3. Keep ExamContext in sync so global submission works
    const sectionIdx = sections.findIndex((s) => s.id === sectionId);
    const essayNumber = sectionIdx + 1;
    submitAnswer(`essay ${essayNumber}`, sectionId, value);

    // 4. Debounced localStorage write — fires 500ms after last keystroke
    if (attemptId && currentModule?.id) {
      pendingStorageRef.current = { sectionId, value, essayNumber };

      if (storageDebounceRef.current) clearTimeout(storageDebounceRef.current);
      storageDebounceRef.current = setTimeout(() => {
        const pending = pendingStorageRef.current;
        if (pending && attemptId && currentModule?.id) {
          updateAnswerInStorage(attemptId, currentModule.id, {
            questionRef: `essay ${pending.essayNumber}`,
            referenceId: pending.sectionId,
            studentResponse: pending.value,
            moduleType: "writing",
            timestamp: Date.now(),
          });
          pendingStorageRef.current = null;
        }
      }, 500);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Show confirmation dialog before submit
  const handleSubmitClick = () => {
    setShowConfirmDialog(true);
  };

  // Handle confirmed submit
  const handleSubmit = async () => {
    setShowConfirmDialog(false);

    if (!currentAttemptModule?.id) {
      toast.error("No active module to submit");
      return;
    }

    setIsSubmitting(true);

    // Flush any pending debounced write before syncing
    flushPendingStorage();

    // Sync local storage to database
    if (attemptId) {
      await syncStoredAnswersToDatabase(attemptId, currentAttemptModule.id);
    }

    try {
      const result = await submitModule();
      if (result.success) {
        submitRedirectTimer.current = setTimeout(() => {
          router.push(`/mock-test/${slug}/${attemptId}`);
        }, 1500);
      }
    } catch (err) {
      setIsSubmitting(false);
      toast.error("Submission failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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

      <WritingNavbar
        timeLeft={timeLeft}
        questions={`${sections.length} Tasks`}
        onSubmit={handleSubmitClick}
        isSubmitting={isSubmitting}
      />

      <main className="mx-auto max-w-7xl pt-28 px-4">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Instructions Panel left side*/}
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-lg bg-white shadow-sm border border-gray-200">
            <div className="flex justify-between items-center border-b border-gray-200 px-4 py-2">
              <h2 className="py-2 text-sm text-gray-900">
                {currentSection?.title || "Reading Passage"}
              </h2>
              <p className="text-xs text-gray-600">
                {wordCounts[currentSection?.id || ""] || 0} words
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {currentSection?.content_text && (
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {currentSection.content_text}
                  </p>
                </div>
              )}

              {currentSection?.resource_url &&
                currentSection.resource_url.match(
                  /\.(jpg|jpeg|png|gif|webp)$/i,
                ) && (
                  <div className="my-4 flex justify-center">
                    <Image
                      src={currentSection.resource_url}
                      alt="Task resource"
                      width={600}
                      height={400}
                      priority={true}
                      className="max-h-96 w-auto rounded-lg border shadow-sm object-contain"
                    />
                  </div>
                )}

              {/* Sub-section instructions */}
              {subSections
                .filter(
                  (ss) =>
                    ss.section_id === currentSection?.id && ss.instruction,
                )
                .map((ss) => (
                  <p
                    key={ss.id}
                    className="mb-4 rounded-lg p-3 text-xs italic whitespace-pre-wrap bg-purple-50 text-purple-900"
                  >
                    {ss.instruction}
                  </p>
                ))}

              {currentSection?.subtext && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">
                    {currentSection.subtext}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Writing Panel right side*/}
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-lg">
            {currentSection?.instruction && (
              <p className="text-xs text-gray-900 mb-2 bg-red-200 p-2 rounded-lg text-center font-medium">
                {currentSection.instruction}
              </p>
            )}

            <div className="flex-1">
              <textarea
                value={answers[currentSection?.id || ""] || ""}
                onChange={(e) =>
                  handleAnswerChange(currentSection?.id || "", e.target.value)
                }
                spellCheck="false"
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="Start writing your answer here..."
                className="w-full h-full resize-none border-1 border-gray-400 rounded-lg bg-gray-50 p-4 focus:ring-1 focus:outline-red-300 text-gray-900 placeholder-gray-400 font-mono text-md leading-relaxed"
                style={{
                  fontFamily: "'Inter', sans-serif",
                  lineHeight: "1.8",
                }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Navigation Footer */}
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
              Previous Task
            </button>
            <div className="flex gap-3">
              {sections.map((section, idx) => (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(idx)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    idx === currentSectionIndex
                      ? "bg-gray-900 text-white"
                      : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  Task {idx + 1}
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
              className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Task
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Submit Module
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Are you sure you want to submit your answers? This action
                  cannot be undone.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowConfirmDialog(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-red-600 rounded-lg text-sm font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    Yes, Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Auto-submit dialog overlay */}
      {showSubmitDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-semibold text-gray-900">
              {submitDialogMessage}
            </p>
            <p className="text-sm text-gray-600">
              Redirecting to the next section...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
