"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenTool } from "lucide-react";
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
    timeLeft,
    currentSectionIndex,
    setCurrentSection,
    loadModule,
    attemptId,
    currentAttemptModule,
    submitModule,
  } = useExam();

  const [moduleLoaded, setModuleLoaded] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});

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

  const currentSection = sections[currentSectionIndex];

  const handleAnswerChange = (sectionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [sectionId]: value }));

    // Count words
    const wordCount = value.trim().split(/\s+/).filter(Boolean).length;
    setWordCounts((prev) => ({ ...prev, [sectionId]: wordCount }));

    // Save to localStorage
    if (attemptId && currentModule?.id) {
      // Find the section index to determine essay number
      const sectionIdx = sections.findIndex((s) => s.id === sectionId);
      const essayNumber = sectionIdx + 1;

      updateAnswerInStorage(attemptId, currentModule.id, {
        questionRef: `essay ${essayNumber}`, // essay 1, essay 2, etc.
        referenceId: sectionId, // section_id for writing
        studentResponse: value,
        moduleType: "writing",
        timestamp: Date.now(),
      });
    }
  };

  // Auto-save answers to context periodically
  useEffect(() => {
    const interval = setInterval(() => {
      // This is handled by localStorage, no need to submit to context continuously
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const buildBlocks = (
    template?: string | null,
    subType?: string | null,
    instruction?: string | null,
  ) => {
    const blocks: Array<{ type: string; content?: string }> = [];

    // Add instruction as first block if it exists
    if (instruction) {
      blocks.push({ type: "instruction", content: instruction });
    }

    if (!template) return blocks;

    try {
      const parsed = JSON.parse(template);
      if (Array.isArray(parsed)) return [...blocks, ...parsed];
      if (parsed?.type) return [...blocks, parsed];
    } catch {
      // fall through
    }
    const allowed = new Set([
      "header",
      "instruction",
      "title",
      "subtitle",
      "box",
      "text",
      "image",
    ]);
    if (
      template.startsWith("http") &&
      (template.includes("/image/") ||
        template.match(/\.(jpg|jpeg|png|gif|webp)$/i))
    ) {
      blocks.push({ type: "image", content: template });
      return blocks;
    }
    const type = subType && allowed.has(subType) ? subType : "text";
    blocks.push({ type, content: template });
    return blocks;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle submit
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
            router.push(`/mock-test/${slug}/${attemptId}`);
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

  // Recommended word counts
  const getRecommendedWordCount = (sectionIndex: number) => {
    return sectionIndex === 0 ? 150 : 250; // Task 1: 150 words, Task 2: 250 words
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
        onSubmit={handleSubmit}
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
    </div>
  );
}
