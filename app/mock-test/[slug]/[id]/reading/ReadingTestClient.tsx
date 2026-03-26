"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useExam } from "@/context/ExamContext";
import { toast } from "sonner";
import { AlertTriangle, Highlighter, Monitor, X } from "lucide-react";
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

// === Highlight System Types & Helpers ===
interface HighlightData {
  id: string;
  startOffset: number;
  endOffset: number;
  text: string;
}

function clearHighlightMarks(container: HTMLElement) {
  const marks = container.querySelectorAll("mark[data-highlight-id]");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    }
  });
  container.normalize();
}

function applyOneHighlight(container: HTMLElement, highlight: HighlightData) {
  const textNodes: { node: Text; start: number; end: number }[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  let offset = 0;
  while ((node = walker.nextNode() as Text | null)) {
    const len = node.textContent?.length ?? 0;
    textNodes.push({ node, start: offset, end: offset + len });
    offset += len;
  }
  const nodesToWrap: { node: Text; wrapStart: number; wrapEnd: number }[] = [];
  for (const tn of textNodes) {
    if (tn.end <= highlight.startOffset || tn.start >= highlight.endOffset)
      continue;
    const wrapStart = Math.max(0, highlight.startOffset - tn.start);
    const wrapEnd = Math.min(
      tn.node.textContent!.length,
      highlight.endOffset - tn.start,
    );
    nodesToWrap.push({ node: tn.node, wrapStart, wrapEnd });
  }
  for (let i = nodesToWrap.length - 1; i >= 0; i--) {
    const { node, wrapStart, wrapEnd } = nodesToWrap[i];
    try {
      const range = document.createRange();
      range.setStart(node, wrapStart);
      range.setEnd(node, wrapEnd);
      const mark = document.createElement("mark");
      mark.setAttribute("data-highlight-id", highlight.id);
      mark.style.backgroundColor = "#fef08a";
      mark.style.borderRadius = "2px";
      mark.style.cursor = "pointer";
      range.surroundContents(mark);
    } catch {
      // Skip if wrapping fails (cross-element boundary)
    }
  }
}

function applyAllHighlights(
  container: HTMLElement,
  highlights: HighlightData[],
) {
  if (highlights.length === 0) return;
  const sorted = [...highlights].sort((a, b) => b.startOffset - a.startOffset);
  for (const h of sorted) {
    applyOneHighlight(container, h);
  }
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
    submitMultipleAnswers,
    setCurrentSection,
    submitModule,
    isLoading,
    showSubmitDialog,
    submitDialogMessage,
    dismissSubmitDialog,
    currentAttemptModule,
  } = useExam();

  const [moduleLoaded, setModuleLoaded] = useState(false);
  // Show a warning on narrow screens where side-by-side layout is impossible
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const localAnswersRef = useRef<Record<string, string>>({});
  const moduleLoadInProgress = useRef(false);
  const submitRedirectTimer = useRef<NodeJS.Timeout | null>(null);

  // === Highlight System State ===
  const [highlightsMap, setHighlightsMap] = useState<
    Record<string, HighlightData[]>
  >({});
  const [highlightPopup, setHighlightPopup] = useState<{
    x: number;
    y: number;
    type: "add" | "remove";
    highlightId?: string;
  } | null>(null);
  const passageRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<Range | null>(null);

  // Detect narrow viewport and warn the student once
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setShowMobileWarning(true);
    }
  }, []);

  // Cleanup redirect timer on unmount
  useEffect(() => {
    return () => {
      if (submitRedirectTimer.current) {
        clearTimeout(submitRedirectTimer.current);
      }
    };
  }, []);

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
        // Load answers from localStorage as a single batch update
        if (attemptId) {
          const storedAnswers = getModuleAnswersFromStorage(
            attemptId,
            "reading",
          );

          // Build valid question set from current module
          const validQuestions = new Set(
            questionAnswers.map((qa) => qa.question_ref),
          );

          const batch: Array<{
            questionRef: string;
            subSectionId: string;
            response: string;
          }> = [];
          storedAnswers.forEach((a) => {
            if (validQuestions.has(a.questionRef)) {
              const key = `${a.referenceId}_${a.questionRef}`;
              localAnswersRef.current[key] = a.studentResponse;
              batch.push({
                questionRef: a.questionRef,
                subSectionId: a.referenceId,
                response: a.studentResponse,
              });
            }
          });
          // Single context update instead of N individual submitAnswer calls
          if (batch.length > 0) {
            submitMultipleAnswers(batch);
          }
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
            success: (result) => `Answers Saved`,
            error: "Failed to save answers",
            duration: 1000,
          },
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentAttemptModule, attemptId]);

  // Periodic auto-save every 3 minutes
  useEffect(() => {
    if (!currentAttemptModule?.id || !attemptId) return;
    const amId = currentAttemptModule.id;

    const interval = setInterval(
      () => {
        syncStoredAnswersToDatabase(attemptId, amId).catch((err) =>
          console.error("Auto-save failed:", err),
        );
      },
      3 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [currentAttemptModule?.id, attemptId]);

  // Memoize passage content so timer-tick re-renders (timeLeft changes every
  // second) don't cause React to re-process the passage DOM, which would
  // destroy the browser's active text selection.
  const passageContent = useMemo(() => {
    if (!currentSection) return null;
    if (currentSection.content_text) {
      return buildPassageBlocks(currentSection.content_text).map(
        (block, idx) => (
          <RenderBlock key={`passage-${idx}`} block={block} theme="green" />
        ),
      );
    }
    const subs = subSections.filter(
      (ss) => ss.section_id === currentSection.id,
    );
    return subs.map((subSection) => (
      <div key={subSection.id} className="mb-6">
        {subSection.boundary_text && (
          <h3 className="text-lg font-semibold text-gray-800 mb-3">
            {subSection.boundary_text}
          </h3>
        )}
        {buildPassageBlocks(subSection.content_template).map((block, idx) => (
          <RenderBlock
            key={`${subSection.id}-passage-${idx}`}
            block={block}
            theme="green"
          />
        ))}
      </div>
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSection?.id]);

  // === Highlight Effects ===
  // Apply highlights synchronously before paint (no flash)
  useLayoutEffect(() => {
    const container = passageRef.current;
    if (!container || !currentSection?.id) return;
    clearHighlightMarks(container);
    const highlights = highlightsMap[currentSection.id] || [];
    applyAllHighlights(container, highlights);
  }, [currentSection?.id, highlightsMap]);

  // Dismiss highlight popup on scroll or click outside
  useEffect(() => {
    if (!highlightPopup) return;
    const dismiss = () => setHighlightPopup(null);
    const handleMouseDown = (e: MouseEvent) => {
      const popup = document.getElementById("highlight-popup");
      if (popup?.contains(e.target as Node)) return;
      dismiss();
    };
    const container = passageRef.current;
    container?.addEventListener("scroll", dismiss);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      container?.removeEventListener("scroll", dismiss);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [highlightPopup]);

  const handlePassageMouseUp = useCallback((e: React.MouseEvent) => {
    // Capture target synchronously (React event may be recycled)
    const target = e.target as HTMLElement;
    // Defer to next frame so the browser fully finalizes the selection
    // before React re-renders and potentially disturbs the DOM
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        const mark = target.closest("mark[data-highlight-id]");
        if (mark) {
          const highlightId = mark.getAttribute("data-highlight-id");
          const rect = mark.getBoundingClientRect();
          setHighlightPopup({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
            type: "remove",
            highlightId: highlightId || undefined,
          });
        } else {
          setHighlightPopup(null);
        }
        return;
      }
      const container = passageRef.current;
      if (!container) return;
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;
      if (range.toString().trim().length === 0) return;
      pendingSelectionRef.current = range.cloneRange();
      const rect = range.getBoundingClientRect();
      setHighlightPopup({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        type: "add",
      });
    });
  }, []);

  const addHighlight = useCallback(() => {
    const range = pendingSelectionRef.current;
    const container = passageRef.current;
    if (!range || !container || !currentSection?.id) return;

    // Use Range API to calculate absolute offsets safely,
    // ignoring whether the anchor is an Element or TextNode.
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(container);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preSelectionRange.toString().length;

    const preEndRange = range.cloneRange();
    preEndRange.selectNodeContents(container);
    preEndRange.setEnd(range.endContainer, range.endOffset);
    const endOffset = preEndRange.toString().length;

    if (startOffset < 0 || endOffset < 0 || startOffset >= endOffset) return;

    const highlight: HighlightData = {
      id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      startOffset,
      endOffset,
      text: range.toString(),
    };

    setHighlightsMap((prev) => ({
      ...prev,
      [currentSection.id]: [...(prev[currentSection.id] || []), highlight],
    }));

    window.getSelection()?.removeAllRanges();
    setHighlightPopup(null);
    pendingSelectionRef.current = null;
  }, [currentSection?.id]);
  const removeHighlight = useCallback(
    (highlightId: string) => {
      if (!currentSection?.id) return;
      setHighlightsMap((prev) => ({
        ...prev,
        [currentSection.id]: (prev[currentSection.id] || []).filter(
          (h) => h.id !== highlightId,
        ),
      }));
      setHighlightPopup(null);
    },
    [currentSection?.id],
  );

  const clearAllHighlights = useCallback(() => {
    if (!currentSection?.id) return;
    setHighlightsMap((prev) => ({
      ...prev,
      [currentSection.id]: [],
    }));
    setHighlightPopup(null);
  }, [currentSection?.id]);

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

    // First sync local storage to database
    if (attemptId) {
      await syncStoredAnswersToDatabase(attemptId, currentAttemptModule.id);
    }

    try {
      const result = await submitModule();
      if (result.success) {
        submitRedirectTimer.current = setTimeout(() => {
          router.push(`/mock-test/${centerSlug}/${attemptId}`);
        }, 1500);
      }
    } catch (err) {
      setIsSubmitting(false);
      toast.error("Submission failed. Please try again.");
    }
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
        onSubmit={handleSubmitClick}
        isSubmitting={isSubmitting}
      />

      {/* Mobile/tablet warning overlay */}
      {showMobileWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
                <Monitor className="w-7 h-7 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Desktop Recommended
              </h3>
              <p className="text-sm text-gray-600">
                The Reading module displays a passage and questions side by
                side. For the best experience, please use a desktop or laptop
                with a screen width of at least 1024px. Continuing on a smaller
                screen will require excessive scrolling.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowMobileWarning(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-900 rounded-lg text-sm font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-full pt-28 px-8">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-[calc(100vh-200px)]">
          {/* Passage panel */}
          <div className="flex flex-col rounded-md bg-white shadow-sm border border-gray-100 lg:basis-[40%] min-h-0">
            <div className="border-b border-gray-200 px-4 py-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex flex-col w-full">
                  <div className="flex w-full items-center justify-between">
                    <h2 className="mb-1 text-sm text-gray-900">
                      {currentSection?.title || "Reading Passage"}
                    </h2>
                    <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400">
                      <Highlighter className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        Select to highlight
                      </span>
                    </div>
                  </div>

                  {currentSection?.subtext && (
                    <h3 className="text-lg font-semibold text-gray-800">
                      {currentSection.subtext}
                    </h3>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {currentSection?.id &&
                    (highlightsMap[currentSection.id]?.length ?? 0) > 0 && (
                      <button
                        onClick={clearAllHighlights}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Clear all highlights"
                      >
                        <X className="w-3 h-3" />
                        Clear
                      </button>
                    )}
                </div>
              </div>
            </div>

            <div
              ref={passageRef}
              onMouseUp={handlePassageMouseUp}
              className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200 select-text"
            >
              <div className="prose prose-zinc max-w-none text-gray-700 select-text">
                {passageContent}
              </div>
            </div>
          </div>

          {/* Questions panel */}
          <div className="flex flex-col bg-white lg:basis-[60%] min-h-0">
            {currentSection?.instruction && (
              <p className="text-xs text-gray-900 mb-2 bg-red-200 p-2 rounded text-center font-medium shrink-0">
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

      {/* Highlight Popup */}
      {highlightPopup && (
        <>
          <div
            id="highlight-popup"
            className="fixed z-[200] -translate-x-1/2 -translate-y-full"
            style={{ left: highlightPopup.x, top: highlightPopup.y }}
          >
            <div className="bg-gray-900 text-white rounded-lg shadow-xl py-1.5 px-2 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
              {highlightPopup.type === "add" ? (
                <button
                  onClick={addHighlight}
                  className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <Highlighter className="w-3.5 h-3.5 text-yellow-400" />
                  Highlight
                </button>
              ) : (
                <button
                  onClick={() =>
                    highlightPopup.highlightId &&
                    removeHighlight(highlightPopup.highlightId)
                  }
                  className="flex items-center gap-1.5 px-2 py-1 hover:bg-gray-700 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-red-400" />
                  Remove
                </button>
              )}
            </div>
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
            </div>
          </div>
        </>
      )}

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
