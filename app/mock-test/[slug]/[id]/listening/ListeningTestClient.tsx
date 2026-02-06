"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Headphones, AlertTriangle } from "lucide-react";
import ListeningNavbar from "@/component/modules/ListeningNavbar";
import RenderBlock from "@/component/modules/RenderBlock";
import { useExam } from "@/context/ExamContext";
import {
  updateAnswerInStorage,
  getModuleAnswersFromStorage,
} from "@/utils/answerStorage";
import { syncStoredAnswersToDatabase } from "@/helpers/answerSync";

interface ListeningTestClientProps {
  slug: string;
}

export default function ListeningTestClient({
  slug,
}: ListeningTestClientProps) {
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
    setCurrentSection,
    loadModule,
    submitAnswer,
    attemptId,
    currentAttemptModule,
    submitModule,
    showSubmitDialog,
    submitDialogMessage,
    dismissSubmitDialog,
    getNextModuleUrl,
  } = useExam();

  const [isPlaying, setIsPlaying] = useState(false);
  const [moduleLoaded, setModuleLoaded] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioEnded, setAudioEnded] = useState(false);
  const [showNavWarning, setShowNavWarning] = useState(false);
  const [pendingSection, setPendingSection] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioTimesRef = useRef<Record<string, number>>({});
  const localAnswersRef = useRef<Record<string, string>>({});
  const moduleLoadInProgress = useRef(false);

  // Handle auto-submit dialog
  useEffect(() => {
    if (showSubmitDialog && submitDialogMessage) {
      const timer = setTimeout(() => {
        const nextUrl = getNextModuleUrl();
        dismissSubmitDialog();
        if (nextUrl) {
          router.push(nextUrl);
        } else {
          router.push(`/mock-test/${slug}/profile`);
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [
    showSubmitDialog,
    submitDialogMessage,
    getNextModuleUrl,
    dismissSubmitDialog,
    router,
    slug,
  ]);

  // Load the listening module on mount
  useEffect(() => {
    if (moduleLoaded || moduleLoadInProgress.current) return;
    if (modules.length === 0) return;

    const listeningModule = modules.find((m) => m.module_type === "listening");
    if (!listeningModule) {
      toast.error("Listening module not found");
      return;
    }

    // Check if module is already loaded
    if (currentModule && currentModule.id === listeningModule.id) {
      setModuleLoaded(true);
      return;
    }

    moduleLoadInProgress.current = true;
    loadModule(listeningModule.id)
      .then(() => {
        setModuleLoaded(true);
        // Load answers from localStorage
        if (attemptId) {
          const storedAnswers = getModuleAnswersFromStorage(
            attemptId,
            "listening",
          );
          const answerMap: Record<string, string> = {};
          storedAnswers.forEach((a) => {
            const key = `${a.referenceId}_${a.questionRef}`;
            answerMap[key] = a.studentResponse;
            // Submit to context
            submitAnswer(a.questionRef, a.referenceId, a.studentResponse);
          });
          localAnswersRef.current = answerMap;
        }
      })
      .catch((error) => {
        console.error("Load listening module error:", error);
        toast.error("Failed to load listening module");
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
    sectionQuestions.forEach((qa) => {
      map[qa.question_ref] = qa.sub_section_id;
    });
    return map;
  }, [sectionQuestions]);

  const questionMap = useMemo(() => {
    const map: Record<string, { answer: string; options?: any[] }> = {};
    sectionQuestions.forEach((qa) => {
      map[qa.question_ref] = {
        answer: "",
        options: qa.options ?? [],
      };
    });
    return map;
  }, [sectionQuestions]);

  const answerMap = useMemo(() => {
    const map: Record<string, string> = {};
    answers.forEach((value) => {
      if (sectionSubSections.some((ss) => ss.id === value.sub_section_id)) {
        const response = Array.isArray(value.student_response)
          ? value.student_response.join(", ")
          : value.student_response;
        map[value.question_ref] = response ?? "";
      }
    });
    return map;
  }, [answers, sectionSubSections]);

  const handleAnswerChange = (questionRef: string, value: string) => {
    const subSectionId = questionToSubSection[questionRef];
    if (!subSectionId) return;

    submitAnswer(questionRef, subSectionId, value);

    // Save to localStorage
    if (attemptId && currentModule?.id) {
      updateAnswerInStorage(attemptId, currentModule.id, {
        questionRef,
        referenceId: subSectionId,
        studentResponse: value,
        moduleType: "listening",
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

  const audioPath = useMemo(() => {
    // Check section resource_url first
    if (currentSection?.resource_url) {
      const url = currentSection.resource_url;
      // Check if it's an audio file
      if (url.match(/\.(mp3|mpeg|wav|ogg|m4a)$/i) || url.includes("/audio/")) {
        return url;
      }
    }

    // Check subsections
    const subsectionAudio = sectionSubSections.find((ss) => {
      if (!ss.resource_url) return false;
      const url = ss.resource_url;
      return url.match(/\.(mp3|mpeg|wav|ogg|m4a)$/i) || url.includes("/audio/");
    })?.resource_url;

    if (subsectionAudio) return subsectionAudio;

    console.warn(
      "[Listening] No audio file found for section:",
      currentSection?.id,
    );
    return "";
  }, [currentSection, sectionSubSections]);

  // Handle section navigation with warning
  const handleSectionChange = (newIndex: number) => {
    if (newIndex === currentSectionIndex) return;

    // Show warning when navigating away from current section
    if (isPlaying && !audioEnded) {
      setShowNavWarning(true);
      setPendingSection(newIndex);
    } else {
      setCurrentSection(newIndex);
    }
  };

  const confirmNavigation = () => {
    if (pendingSection !== null) {
      setCurrentSection(pendingSection);
      setPendingSection(null);
    }
    setShowNavWarning(false);
  };

  const cancelNavigation = () => {
    setPendingSection(null);
    setShowNavWarning(false);
  };

  // Audio management
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSection?.id) return;

    setAudioEnded(false);
    setAudioProgress(0);

    return () => {
      if (audio && currentSection?.id) {
        audioTimesRef.current[currentSection.id] = audio.currentTime;
      }
    };
  }, [currentSection?.id]);

  useEffect(() => {
    if (moduleLoaded && sections.length > 0 && audioRef.current && audioPath) {
      const audio = audioRef.current;

      // Add error handler
      const handleError = (e: Event) => {
        console.error("[Listening] Audio error:", e);
        toast.error("Failed to load audio. Please check your connection.");
        setIsPlaying(false);
      };

      audio.addEventListener("error", handleError);
      audio.load();

      const savedTime = audioTimesRef.current[currentSection?.id || ""] || 0;
      audio.currentTime = savedTime;

      const playAudio = async () => {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (err) {
          console.error("Audio autoplay failed:", err);
          toast.warning("Click the play button to start audio");
          setIsPlaying(false);
        }
      };

      playAudio();

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => {
        // Auto-resume if not ended or seeking
        if (!audio.ended && !audio.seeking) {
          setTimeout(() => {
            audio.play().catch(console.error);
          }, 100);
        }
        setIsPlaying(false);
      };
      const handleEnded = () => {
        setIsPlaying(false);
        setAudioEnded(true);
      };
      const handleTimeUpdate = () => {
        if (currentSection?.id) {
          audioTimesRef.current[currentSection.id] = audio.currentTime;
        }
        if (audio.duration) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.addEventListener("play", handlePlay);
      audio.addEventListener("pause", handlePause);
      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("timeupdate", handleTimeUpdate);

      return () => {
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("error", handleError);
      };
    }
  }, [moduleLoaded, sections.length, audioPath, currentSection?.id]);

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

      <ListeningNavbar
        timeLeft={timeLeft}
        questions={`${sectionQuestions.length} Qs`}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      <main className="mx-auto max-w-7xl pt-28 px-4">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Audio Player Panel */}
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-md bg-white shadow-sm border border-gray-100">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">
                {currentSection?.title || "Listening Audio"}
              </h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-8">
              <div className="w-full max-w-md">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
                    <Headphones className="h-10 w-10 text-blue-600" />
                  </div>
                </div>
                {audioPath ? (
                  <>
                    <audio
                      ref={audioRef}
                      className="hidden"
                      src={audioPath}
                      preload="auto"
                      controlsList="nodownload noplaybackrate"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    <div className="w-full">
                      <div className="bg-gray-100 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Audio Player
                          </span>
                          {isPlaying ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-600 font-medium">
                                Playing
                              </span>
                            </div>
                          ) : audioEnded ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 font-medium">
                                Completed
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Ready</span>
                          )}
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${audioProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-4">
                      <p className="text-sm text-blue-700">
                        <strong>Note:</strong> The audio will play automatically
                        and cannot be paused. Listen carefully and answer the
                        questions.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-red-900 mb-2">
                      Audio Not Available
                    </p>
                    <p className="text-xs text-red-700">
                      The audio file for this section could not be loaded.
                      Please contact your administrator or try refreshing the
                      page.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Questions Panel */}
          <div className="flex h-[calc(100vh-200px)] flex-col bg-white">
            {currentSection?.instruction && (
              <p className="text-xs text-gray-900 mb-2 bg-red-200 p-2 rounded-lg text-center font-medium">
                {currentSection.instruction}
              </p>
            )}

            <div className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="space-y-6 mt-4">
                {currentSection?.resource_url &&
                  currentSection.resource_url.match(
                    /\.(jpg|jpeg|png|gif|webp)$/i,
                  ) && (
                    <div className="my-4 flex justify-center">
                      <img
                        src={currentSection.resource_url}
                        alt="Section resource"
                        className="max-h-96 w-auto rounded-lg border shadow-sm object-contain"
                      />
                    </div>
                  )}
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

                      {subSection.resource_url &&
                        subSection.resource_url.match(
                          /\.(jpg|jpeg|png|gif|webp)$/i,
                        ) && (
                          <div className="my-4 flex justify-center">
                            <img
                              src={subSection.resource_url}
                              alt="Subsection resource"
                              className="max-h-96 w-auto rounded-lg border shadow-sm object-contain"
                            />
                          </div>
                        )}
                      {blocks.map((block, idx) => (
                        <RenderBlock
                          key={`${subSection.id}-${idx}`}
                          block={block}
                          theme="blue"
                          questions={questionMap}
                          answers={answerMap}
                          onAnswerChange={handleAnswerChange}
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

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white shadow-lg">
        <div className="mx-auto max-w-7xl p-4">
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() =>
                handleSectionChange(Math.max(0, currentSectionIndex - 1))
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
                  onClick={() => handleSectionChange(idx)}
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
                handleSectionChange(
                  Math.min(sections.length - 1, currentSectionIndex + 1),
                )
              }
              disabled={currentSectionIndex === sections.length - 1}
              className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Warning Modal */}
      {showNavWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Navigation Warning
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  Moving to another section will restart the audio from the
                  beginning of that section, and you will lose time. Are you
                  sure you want to continue?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={cancelNavigation}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmNavigation}
                    className="px-4 py-2 bg-gray-600 rounded-lg text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                  >
                    Continue
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
