"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Headphones, AlertTriangle, Play } from "lucide-react";
import ListeningNavbar from "@/component/modules/ListeningNavbar";
import RenderBlock from "@/component/modules/RenderBlock";
import { useExam } from "@/context/ExamContext";
import {
  updateAnswerInStorage,
  getModuleAnswersFromStorage,
} from "@/utils/answerStorage";
import { syncStoredAnswersToDatabase } from "@/helpers/answerSync";
import { buildBlocks } from "@/helpers/contentBlocks";

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
    submitMultipleAnswers,
    attemptId,
    currentAttemptModule,
    submitModule,
    showSubmitDialog,
    submitDialogMessage,
    dismissSubmitDialog,
  } = useExam();

  const [isPlaying, setIsPlaying] = useState(false);
  const [moduleLoaded, setModuleLoaded] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioEnded, setAudioEnded] = useState(false);
  // Whether autoplay was blocked and we need to show a manual Play button
  const [needsManualPlay, setNeedsManualPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioTimesRef = useRef<Record<string, number>>({});
  const audioEndedRef = useRef<Record<string, boolean>>({});
  const localAnswersRef = useRef<Record<string, string>>({});
  const moduleLoadInProgress = useRef(false);
  // Track the section ID that the current audio src belongs to so we
  // never accidentally apply the wrong saved timestamp after a section change.
  const loadedAudioSectionRef = useRef<string | null>(null);
  const isPausedForNavigationRef = useRef(false);

  // Handle auto-submit dialog → navigate to waiting room
  useEffect(() => {
    if (showSubmitDialog && submitDialogMessage) {
      const timer = setTimeout(() => {
        dismissSubmitDialog();
        router.push(`/mock-test/${slug}/${attemptId}`);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [
    showSubmitDialog,
    submitDialogMessage,
    dismissSubmitDialog,
    router,
    slug,
    attemptId,
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
        // Load answers from localStorage and submit as a single batch
        if (attemptId) {
          const storedAnswers = getModuleAnswersFromStorage(
            attemptId,
            "listening",
          );
          const batch: Array<{
            questionRef: string;
            subSectionId: string;
            response: string;
          }> = [];
          storedAnswers.forEach((a) => {
            const key = `${a.referenceId}_${a.questionRef}`;
            localAnswersRef.current[key] = a.studentResponse;
            batch.push({
              questionRef: a.questionRef,
              subSectionId: a.referenceId,
              response: a.studentResponse,
            });
          });
          // Single context update instead of N individual submitAnswer calls
          if (batch.length > 0) {
            submitMultipleAnswers(batch);
          }
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

  // Restore audio times from sessionStorage on mount (for refresh recovery)
  useEffect(() => {
    if (!moduleLoaded || !attemptId || sections.length === 0) return;
    sections.forEach((section) => {
      const key = `audio_time_${attemptId}_${section.id}`;
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const time = parseFloat(stored);
        if (!isNaN(time) && time > 0) {
          audioTimesRef.current[section.id] = time;
        }
      }
    });
  }, [moduleLoaded, attemptId, sections]);

  // Save audio time on page unload (refresh/close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const audio = audioRef.current;
      if (audio && currentSection?.id && attemptId) {
        try {
          sessionStorage.setItem(
            `audio_time_${attemptId}_${currentSection.id}`,
            String(audio.currentTime),
          );
        } catch {}
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [attemptId, currentSection?.id]);

  // Reset navigation pause flag when section changes
  useEffect(() => {
    isPausedForNavigationRef.current = false;
  }, [currentSectionIndex]);

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

  // Build a proxied audio URL so the real storage URL is never in the DOM.
  // We pass section/subsection IDs to the server which resolves & streams audio.
  const audioProxyUrl = useMemo(() => {
    // Check section resource_url first (only check type, don't expose url)
    if (currentSection?.resource_url) {
      const url = currentSection.resource_url;
      if (url.match(/\.(mp3|mpeg|wav|ogg|m4a)$/i) || url.includes("/audio/")) {
        return `/api/audio?sectionId=${encodeURIComponent(currentSection.id)}`;
      }
    }

    // Check subsections
    const subsectionWithAudio = sectionSubSections.find((ss) => {
      if (!ss.resource_url) return false;
      const url = ss.resource_url;
      return url.match(/\.(mp3|mpeg|wav|ogg|m4a)$/i) || url.includes("/audio/");
    });

    if (subsectionWithAudio) {
      return `/api/audio?subSectionId=${encodeURIComponent(subsectionWithAudio.id)}`;
    }

    console.warn(
      "[Listening] No audio file found for section:",
      currentSection?.id,
    );
    return "";
  }, [currentSection, sectionSubSections]);

  // Handle section navigation — save audio position and switch seamlessly
  const handleSectionChange = (newIndex: number) => {
    if (newIndex === currentSectionIndex) return;
    const audio = audioRef.current;
    if (audio && currentSection?.id) {
      const currentTime = audio.currentTime;
      audioTimesRef.current[currentSection.id] = currentTime;
      if (attemptId) {
        try {
          sessionStorage.setItem(
            `audio_time_${attemptId}_${currentSection.id}`,
            String(currentTime),
          );
        } catch {}
      }
      isPausedForNavigationRef.current = true;
      if (!audio.paused) {
        audio.pause();
      }
    }
    setCurrentSection(newIndex);
  };

  // Manual play handler — used when autoplay is blocked by the browser
  const handleManualPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio
      .play()
      .then(() => {
        setNeedsManualPlay(false);
        setIsPlaying(true);
      })
      .catch(console.error);
  }, []);

  // ---------- Audio management ----------
  // Single consolidated effect: set src imperatively, attach listeners,
  // seek to saved position, and autoplay. This avoids the double-load
  // race caused by React updating the DOM `src` attribute (which triggers
  // a browser auto-load) AND a separate `audio.load()` call.
  useEffect(() => {
    if (!moduleLoaded || sections.length === 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    const sectionId = currentSection?.id || "";
    const url = audioProxyUrl;

    // Update tracking ref
    loadedAudioSectionRef.current = sectionId;
    isPausedForNavigationRef.current = false;

    // Reset UI for the new section
    const wasEnded = audioEndedRef.current[sectionId] ?? false;
    setAudioEnded(wasEnded);
    setNeedsManualPlay(false);

    // Restore progress from saved time
    const savedTime = audioTimesRef.current[sectionId] ?? 0;
    if (wasEnded) {
      setAudioProgress(100);
      setIsPlaying(false);
      return; // Don't reload audio for a completed section
    }

    if (!url) {
      setAudioProgress(0);
      setIsPlaying(false);
      return;
    }

    // Set src imperatively — do NOT use a React prop on <audio>.
    // This prevents the browser from auto-loading when React commits
    // the DOM change, which races with our explicit load() call.
    audio.src = url;
    audio.load();

    // --- Event handlers ---
    const handleLoadedMetadata = () => {
      if (loadedAudioSectionRef.current !== sectionId) return;
      // Seek to saved position
      if (savedTime > 0 && savedTime < audio.duration) {
        audio.currentTime = savedTime;
        setAudioProgress((savedTime / audio.duration) * 100);
      } else {
        setAudioProgress(0);
      }
      // Attempt autoplay
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setNeedsManualPlay(false);
        })
        .catch(() => {
          setIsPlaying(false);
          setNeedsManualPlay(true);
        });
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      if (!audio.ended && !audio.seeking && !isPausedForNavigationRef.current) {
        setTimeout(() => {
          if (loadedAudioSectionRef.current === sectionId) {
            audio.play().catch(console.error);
          }
        }, 100);
      }
      setIsPlaying(false);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setAudioEnded(true);
      audioEndedRef.current[sectionId] = true;
    };
    let lastStorageSave = 0;
    const handleTimeUpdate = () => {
      if (loadedAudioSectionRef.current === sectionId) {
        audioTimesRef.current[sectionId] = audio.currentTime;
      }
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
      // Throttled save to sessionStorage for refresh recovery
      if (attemptId && audio.currentTime > 0) {
        const now = Date.now();
        if (now - lastStorageSave > 2000) {
          lastStorageSave = now;
          try {
            sessionStorage.setItem(
              `audio_time_${attemptId}_${sectionId}`,
              String(audio.currentTime),
            );
          } catch {}
        }
      }
    };
    const handleError = () => {
      toast.error("Failed to load audio. Please check your connection.");
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("error", handleError);

    return () => {
      // Save time before cleanup
      if (
        loadedAudioSectionRef.current === sectionId &&
        audio.currentTime > 0
      ) {
        audioTimesRef.current[sectionId] = audio.currentTime;
      }
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("error", handleError);
    };
  }, [
    moduleLoaded,
    sections.length,
    audioProxyUrl,
    currentSection?.id,
    attemptId,
  ]);

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
        setTimeout(() => {
          router.push(`/mock-test/${slug}/${attemptId}`);
        }, 1500);
      }
    } catch (err) {
      setIsSubmitting(false);
      toast.error("Submission failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Always-rendered audio element — src set imperatively by the effect */}
      <audio
        ref={audioRef}
        className="hidden"
        preload="auto"
        controlsList="nodownload noplaybackrate"
        onContextMenu={(e) => e.preventDefault()}
      />

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
        onSubmit={handleSubmitClick}
        isSubmitting={isSubmitting}
      />

      <main className="mx-auto max-w-full pt-28 px-8">
        <div className="grid gap-8 lg:grid-cols-[4fr_6fr]">
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
                {audioProxyUrl ? (
                  <>
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

                      {/* Visible Play button shown when autoplay is blocked */}
                      {needsManualPlay && (
                        <button
                          onClick={handleManualPlay}
                          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors mb-4"
                        >
                          <Play className="h-5 w-5" />
                          Start Listening
                        </button>
                      )}
                    </div>
                    <div className="rounded-lg bg-red-50 p-4">
                      <p className="text-sm text-red-700">
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
