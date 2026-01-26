"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Headphones } from "lucide-react";
import ListeningNavbar from "@/component/modules/ListeningNavbar";
import RenderBlock from "@/component/modules/RenderBlock";
import { ExamProvider, useExam } from "@/context/ExamContext";

function ListeningTestPage() {
  const router = useRouter();
  const params = useParams();
  const {
    modules,
    sections,
    subSections,
    questionAnswers,
    answers,
    timeLeft,
    currentSectionIndex,
    setCurrentSection,
    loadExam,
    loadModule,
    submitAnswer,
    startTimer,
    isLoading,
  } = useExam();

  const [isStarted, setIsStarted] = useState(false);
  const [selectedSection, setSelectedSection] = useState<number | null>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [moduleLoaded, setModuleLoaded] = useState(false);
  const examLoadedRef = useRef(false);
  const timerStartedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const attemptId = params.id as string;
    if (!attemptId) {
      toast.error("Invalid session");
      router.push("/mock-test");
      return;
    }

    if (!examLoadedRef.current && modules.length === 0) {
      examLoadedRef.current = true;
      loadExam(attemptId).catch((error) => {
        console.error("Load exam error:", error);
        toast.error("Failed to load exam");
      });
      return;
    }

    if (moduleLoaded) return;
    if (modules.length === 0) return;

    const storedId = sessionStorage.getItem("listeningModuleId");
    const storedModule = storedId
      ? modules.find((m) => m.id === storedId)
      : null;
    const moduleId =
      storedModule?.id ||
      modules.find((m) => m.module_type === "listening")?.id;

    if (!moduleId) {
      toast.error("Module not found");
      setModuleLoaded(true);
      return;
    }

    loadModule(moduleId)
      .then(() => setModuleLoaded(true))
      .catch((error) => {
        console.error("Init error:", error);
        toast.error("Failed to load listening module");
        setModuleLoaded(true);
      });
  }, [params.id, router, modules, loadModule, moduleLoaded, loadExam]);

  useEffect(() => {
    if (isStarted && !timerStartedRef.current) {
      timerStartedRef.current = true;
      startTimer(30);
    }
  }, [isStarted, startTimer]);

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
  };

  const buildBlocks = (template?: string | null, subType?: string | null) => {
    if (!template) return [] as Array<{ type: string; content?: string }>;
    try {
      const parsed = JSON.parse(template);
      if (Array.isArray(parsed)) return parsed;
      if (parsed?.type) return [parsed];
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
    const type = subType && allowed.has(subType) ? subType : "text";
    return [{ type, content: template }];
  };

  const sectionMeta = sections.map((section) => {
    const sectionSubSectionIds = subSections
      .filter((ss) => ss.section_id === section.id)
      .map((ss) => ss.id);
    const refs = questionAnswers
      .filter((qa) => sectionSubSectionIds.includes(qa.sub_section_id))
      .map((qa) => Number(qa.question_ref))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    const questionRange = refs.length
      ? `${refs[0]}-${refs[refs.length - 1]}`
      : `${questionAnswers.length} questions`;

    return {
      id: section.section_index,
      title: section.title || `Section ${section.section_index}`,
      description: section.subtext || "Listening Section",
      questions: questionRange,
    };
  });

  const audioPath =
    currentSection?.resource_url ||
    sectionSubSections.find((ss) => ss.resource_url)?.resource_url ||
    "";

  useEffect(() => {
    if (isStarted && audioRef.current) {
      const audio = audioRef.current;
      audio.load();
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.error("Audio autoplay failed:", err);
            setIsPlaying(false);
          });
      }

      const handlePause = () => {
        if (audio.currentTime > 0 && !audio.ended) {
          audio.play().catch((err) => console.error("Resume failed:", err));
        }
      };

      const handlePlay = () => setIsPlaying(true);
      const handleEnded = () => setIsPlaying(false);
      const handleSeeking = () => {
        if (audio.currentTime > 0) {
          audio.currentTime = audio.currentTime;
        }
      };

      audio.addEventListener("pause", handlePause);
      audio.addEventListener("play", handlePlay);
      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("seeking", handleSeeking);

      return () => {
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("play", handlePlay);
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("seeking", handleSeeking);
      };
    }
  }, [currentSectionIndex, isStarted]);

  if (!isStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-full max-w-5xl lg:max-w-7xl rounded-2xl bg-white p-12">
          <div className="flex items-start justify-between">
            <div className="flex gap-6 items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
                <Headphones className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
                  Listening Test
                </h1>
                <p className="text-center text-lg text-gray-600">
                  {sectionMeta.length} sections • 30 minutes
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-6">
              <h2 className="mb-3 font-semibold text-gray-900">
                Instructions:
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• The timer will start automatically when you begin</li>
                <li>• You cannot pause or restart the test</li>
                <li>• The audio will play once per section</li>
              </ul>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 font-semibold text-gray-900">
              Select a section to start:
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {sectionMeta.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    selectedSection === section.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <h3 className="font-semibold text-gray-900">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    Questions {section.questions}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              if (selectedSection) {
                setIsStarted(true);
                setCurrentSection(selectedSection - 1);
              }
            }}
            disabled={!selectedSection || isLoading}
            className="w-full rounded-lg bg-blue-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedSection ? "Start Test" : "Select a section to begin"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <ListeningNavbar
        timeLeft={timeLeft}
        questions={`${sectionQuestions.length} Qs`}
      />

      <main className="mx-auto max-w-7xl pt-28 px-4">
        <div className="grid gap-8 lg:grid-cols-2">
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
                  <audio
                    ref={audioRef}
                    className="hidden"
                    src={audioPath}
                    preload="auto"
                  />
                ) : (
                  <div className="text-sm text-gray-600 text-center">
                    Audio not available for this section.
                  </div>
                )}
                <div className="mb-6 text-center">
                  {isPlaying ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">
                        Audio Playing...
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 rounded-lg">
                      <span className="text-sm font-medium">
                        Loading audio...
                      </span>
                    </div>
                  )}
                </div>
                <div className="rounded-lg bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">
                    <strong>Note:</strong> The audio will play automatically and
                    can’t be paused or replayed.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100vh-200px)] flex-col bg-white">
            {currentSection?.instruction && (
              <p className="text-xs text-gray-900 mb-2 bg-red-200 p-2 rounded text-center font-medium">
                {currentSection.instruction}
              </p>
            )}
            <div className="flex-1 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-gray-200">
              <div className="space-y-3">
                {sectionSubSections.map((subSection) => {
                  const blocks = buildBlocks(
                    subSection.content_template ?? "",
                    subSection.sub_type ?? null,
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
    </div>
  );
}

export default function ListeningPage() {
  return (
    <ExamProvider>
      <ListeningTestPage />
    </ExamProvider>
  );
}
