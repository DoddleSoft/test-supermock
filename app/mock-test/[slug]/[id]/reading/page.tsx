"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExamProvider, useExam } from "@/context/ExamContext";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import RenderBlock from "@/component/modules/RenderBlock";
import { Loader } from "@/component/ui/loader";
import ReadingNavbar from "@/component/modules/ReadingNavbar";

function ReadingTestPage() {
  const router = useRouter();
  const params = useParams();
  const {
    modules,
    currentModule,
    sections,
    subSections,
    questionAnswers,
    answers,
    timeLeft,
    currentSectionIndex,
    completionPercentage,
    answeredQuestions,
    totalQuestions,
    loadExam,
    loadModule,
    submitAnswer,
    setCurrentSection,
    startTimer,
    submitModule,
    isLoading,
  } = useExam();

  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);
  const examLoadedRef = useRef(false);
  const [moduleLoaded, setModuleLoaded] = useState(false);

  useEffect(() => {
    const init = async () => {
      const attemptId = params.id as string;

      if (!attemptId) {
        toast.error("Invalid session");
        router.push("/mock-test");
        return;
      }

      if (!examLoadedRef.current && modules.length === 0) {
        examLoadedRef.current = true;
        try {
          await loadExam(attemptId);
        } catch (error) {
          console.error("Load exam error:", error);
        }
        return;
      }

      try {
        if (moduleLoaded) return;
        if (modules.length === 0) return;

        const storedId = sessionStorage.getItem("readingModuleId");
        const storedModule = storedId
          ? modules.find((m) => m.id === storedId)
          : null;
        const moduleId =
          storedModule?.id ||
          modules.find((m) => m.module_type === "reading")?.id;

        if (!moduleId) {
          toast.error("Module not found");
          setModuleLoaded(true);
          router.back();
          return;
        }

        await loadModule(moduleId);
        setModuleLoaded(true);
        startTimer(60);
      } catch (error) {
        console.error("Init error:", error);
        toast.error("Failed to load module");
        setModuleLoaded(true);
      }
    };

    init();
  }, [
    loadModule,
    startTimer,
    router,
    params.id,
    modules,
    loadExam,
    moduleLoaded,
  ]);

  const handleAnswerChange = (questionRef: string, value: string) => {
    const subSectionId = questionToSubSection[questionRef];
    if (!subSectionId) return;
    submitAnswer(questionRef, subSectionId, value);
  };

  const handleSubmit = async () => {
    if (answeredQuestions < totalQuestions) {
      setIsConfirmingSubmit(true);
      return;
    }
    await confirmSubmit();
  };

  const confirmSubmit = async () => {
    try {
      const result = await submitModule();
      if (result.success) {
        toast.success(`Module completed! Band Score: ${result.bandScore}`);
        const centerSlug = params.slug as string;
        const attemptId = params.id as string;
        router.push(`/mock-test/${centerSlug}/${attemptId}/results`);
      } else {
        toast.error(result.error || "Failed to submit");
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit module");
    } finally {
      setIsConfirmingSubmit(false);
    }
  };

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

  const buildPassageBlocks = (content?: string | null) => {
    if (!content) return [] as Array<{ type: string; content?: string }>;
    const normalized = content.includes("<")
      ? content
      : content.replace(/\n/g, "<br />");
    return [{ type: "html", content: normalized }];
  };

  if (isLoading || !currentModule) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-white">
      <ReadingNavbar
        timeLeft={timeLeft}
        questions={
          sectionQuestions.length
            ? `${sectionQuestions[0].question_ref}-${sectionQuestions[sectionQuestions.length - 1].question_ref}`
            : undefined
        }
      />

      <main className="mx-auto max-w-7xl pt-28 px-4">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex h-[calc(100vh-200px)] flex-col rounded-md bg-white shadow-sm border border-gray-100">
            <div className="border-b border-gray-200 px-4 py-2">
              <h2 className="mb-2 text-sm font-bold text-gray-900">
                {currentSection?.title || "Reading Passage"}
              </h2>
              {currentSection?.subtext && (
                <h3 className="text-md font-semibold text-gray-800">
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

      {isConfirmingSubmit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Incomplete Answers
              </h3>
              <p className="text-gray-600 mb-6">
                You have answered {answeredQuestions} out of {totalQuestions}{" "}
                questions. Are you sure you want to submit?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmingSubmit(false)}
                  className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 rounded-xl font-semibold text-gray-700"
                >
                  Continue
                </button>
                <button
                  onClick={confirmSubmit}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl font-semibold text-white"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReadingPage() {
  return (
    <ExamProvider>
      <ReadingTestPage />
    </ExamProvider>
  );
}
