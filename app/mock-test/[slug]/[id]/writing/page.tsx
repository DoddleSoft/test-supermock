"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { PenTool } from "lucide-react";
import WritingNavbar from "@/component/modules/WritingNavbar";
import RenderBlock from "@/component/modules/RenderBlock";
import { ExamProvider, useExam } from "@/context/ExamContext";

function WritingTestPage() {
  const router = useRouter();
  const params = useParams();
  const {
    modules,
    sections,
    subSections,
    timeLeft,
    currentSectionIndex,
    setCurrentSection,
    loadExam,
    loadModule,
    startTimer,
    isLoading,
  } = useExam();

  const [isStarted, setIsStarted] = useState(false);
  const [selectedTask, setSelectedTask] = useState<number | null>(1);
  const [moduleLoaded, setModuleLoaded] = useState(false);
  const examLoadedRef = useRef(false);
  const timerStartedRef = useRef(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

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

    const storedId = sessionStorage.getItem("writingModuleId");
    const storedModule = storedId
      ? modules.find((m) => m.id === storedId)
      : null;
    const moduleId =
      storedModule?.id || modules.find((m) => m.module_type === "writing")?.id;

    if (!moduleId) {
      toast.error("Module not found");
      setModuleLoaded(true);
      return;
    }

    loadModule(moduleId)
      .then(() => setModuleLoaded(true))
      .catch((error) => {
        console.error("Init error:", error);
        toast.error("Failed to load writing module");
        setModuleLoaded(true);
      });
  }, [params.id, router, modules, loadModule, moduleLoaded, loadExam]);

  useEffect(() => {
    if (isStarted && !timerStartedRef.current) {
      timerStartedRef.current = true;
      startTimer(60);
    }
  }, [isStarted, startTimer]);

  const currentSection = sections[currentSectionIndex];
  const sectionSubSections = subSections.filter(
    (ss) => ss.section_id === currentSection?.id,
  );

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

  const tasks = useMemo(
    () =>
      sections.map((section, idx) => ({
        id: idx + 1,
        title: section.title || `Task ${idx + 1}`,
        description: section.subtext || "Write your response",
        minWords: section.params?.min_words || (idx === 0 ? 150 : 250),
      })),
    [sections],
  );

  const countWords = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

  const handleAnswerChange = (sectionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [sectionId]: value,
    }));
  };

  if (!isStarted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-full max-w-5xl rounded-2xl bg-white p-12">
          <div className="flex items-start justify-between">
            <div className="flex gap-6 items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-50">
                <PenTool className="h-8 w-8 text-purple-600" />
              </div>
              <div>
                <h1 className="mb-2 text-center text-3xl font-bold text-gray-900">
                  Writing Test
                </h1>
                <p className="text-center text-lg text-gray-600">
                  {tasks.length} tasks • 60 minutes
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-6">
              <h2 className="mb-3 font-semibold text-gray-900">
                Instructions:
              </h2>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• Task 1: Write at least 150 words</li>
                <li>• Task 2: Write at least 250 words</li>
                <li>• The timer will start automatically when you begin</li>
              </ul>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 font-semibold text-gray-900">
              Select a task to start:
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task.id)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    selectedTask === task.id
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <h3 className="font-semibold text-gray-900">{task.title}</h3>
                  <p className="text-sm text-gray-600">{task.description}</p>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    Min. {task.minWords} words
                  </p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              if (selectedTask) {
                setIsStarted(true);
                setCurrentSection(selectedTask - 1);
              }
            }}
            disabled={!selectedTask || isLoading}
            className="w-full rounded-lg bg-purple-600 px-8 py-4 text-lg font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedTask ? "Start Test" : "Select a task to begin"}
          </button>
        </div>
      </div>
    );
  }

  const currentAnswer = currentSection ? answers[currentSection.id] || "" : "";
  const currentMinWords =
    currentSection?.params?.min_words ||
    (currentSectionIndex === 0 ? 150 : 250);

  return (
    <div className="min-h-screen bg-white">
      <WritingNavbar timeLeft={timeLeft} />

      <main className="mx-auto max-w-7xl px-4 pt-28">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-md bg-white shadow-sm border border-gray-100">
            <div className="border-b border-gray-200 px-4 py-2">
              <h2 className="mb-2 text-sm font-bold text-gray-900">
                {currentSection?.title || "Writing Task"}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
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
                          theme="purple"
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex h-[calc(100vh-200px)] flex-col bg-white">
            <div className="mb-2 text-right text-sm">
              <span
                className={
                  countWords(currentAnswer) >= currentMinWords
                    ? "text-green-600 font-semibold"
                    : "text-gray-600"
                }
              >
                {countWords(currentAnswer)} words
              </span>
              <span className="text-gray-500">
                {" "}
                / {currentMinWords} minimum
              </span>
            </div>
            <textarea
              value={currentAnswer}
              onChange={(e) =>
                currentSection &&
                handleAnswerChange(currentSection.id, e.target.value)
              }
              className="flex-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-200 resize-none scrollbar-thin scrollbar-thumb-gray-200"
              placeholder="Type your answer here..."
            />
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white px-6 py-2 shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={() =>
              setCurrentSection(Math.max(0, currentSectionIndex - 1))
            }
            disabled={currentSectionIndex === 0}
            className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="flex gap-2">
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
            className="rounded-lg bg-gray-900 px-6 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WritingPage() {
  return (
    <ExamProvider>
      <WritingTestPage />
    </ExamProvider>
  );
}
