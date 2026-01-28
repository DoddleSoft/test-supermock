"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { debounce } from "lodash";
import { useAuth } from "@/context/AuthContext";

export interface Answer {
  question_ref: string;
  sub_section_id: string;
  student_response: string | string[];
  is_flagged?: boolean;
  timestamp: number;
}

export interface Module {
  id: string;
  module_type: "reading" | "listening" | "writing" | "speaking";
  heading: string | null;
  subheading: string | null;
  instruction: string | null;
}

export interface Section {
  id: string;
  module_id: string;
  title: string | null;
  section_index: number;
  content_type: string | null;
  resource_url: string | null;
  content_text: string | null;
  instruction: string | null;
  params: any;
  subtext: string | null;
}

export interface SubSection {
  id: string;
  section_id: string;
  title: string | null;
  sub_section_index: number;
  question_type: string | null;
  instruction: string | null;
  content_template?: string | null;
  resource_url?: string | null;
  boundary_text?: string | null;
  sub_type?: string | null;
}

export interface QuestionAnswer {
  id: string;
  sub_section_id: string;
  question_ref: string;
  correct_answers: any;
  options: any;
  explanation: string | null;
  marks: number;
}

export interface AttemptModule {
  id: string;
  module_id: string;
  status: "pending" | "in_progress" | "completed";
  started_at: string | null;
  time_spent_seconds: number;
}

interface ExamState {
  // Attempt Info
  attemptId: string | null;
  paperId: string | null;

  // Module Data
  modules: Module[];
  currentModuleId: string | null;
  currentModule: Module | null;
  currentAttemptModule: AttemptModule | null;

  // Section Data
  sections: Section[];
  currentSectionIndex: number;
  currentSection: Section | null;

  // Questions & Answers
  subSections: SubSection[];
  questionAnswers: QuestionAnswer[];
  answers: Map<string, Answer>;

  // RPC Cached Content
  moduleContentMap: Record<string, RpcSection[]>;

  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Timer
  timeLeft: number;
  isTimerRunning: boolean;

  // Computed
  totalQuestions: number;
  answeredQuestions: number;
  flaggedQuestions: string[];
  completionPercentage: number;
}

interface ExamContextType extends ExamState {
  // Actions
  loadExam: (attemptId: string) => Promise<void>;
  loadModule: (moduleId: string) => Promise<void>;
  setCurrentSection: (index: number) => void;
  submitAnswer: (
    questionRef: string,
    subSectionId: string,
    response: string | string[],
  ) => void;
  toggleFlag: (questionRef: string, subSectionId: string) => void;
  startTimer: (durationMinutes: number) => void;
  stopTimer: () => void;
  submitModule: () => Promise<{
    success: boolean;
    totalScore?: number;
    maxScore?: number;
    bandScore?: number;
    error?: string;
  }>;
  saveProgress: () => Promise<void>;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

interface RpcQuestion {
  id: string;
  question_ref: string;
  options: any;
  marks: number;
}

interface RpcSubSection {
  id: string;
  content_template: string | null;
  sub_type: string | null;
  resource_url: string | null;
  boundary_text: string | null;
  questions: RpcQuestion[];
}

interface RpcSection {
  id: string;
  title: string | null;
  instruction: string | null;
  content_text: string | null;
  content_type: string | null;
  resource_url: string | null;
  section_index: number;
  subtext: string | null;
  subsections: RpcSubSection[];
}

interface RpcModule {
  id: string;
  module_type: "reading" | "listening" | "writing" | "speaking";
  heading: string | null;
  instruction: string | null;
  view_option?: string | null;
  attempt_status?: string | null;
  time_remaining?: number | null;
  sections: RpcSection[];
}

interface RpcExamPayload {
  paper: {
    id: string;
    title?: string | null;
    instruction?: string | null;
    paper_type?: string | null;
  };
  modules: RpcModule[];
}

export function ExamProvider({ children }: { children: React.ReactNode }) {
  const { studentId } = useAuth();
  const [state, setState] = useState<ExamState>({
    attemptId: null,
    paperId: null,
    modules: [],
    currentModuleId: null,
    currentModule: null,
    currentAttemptModule: null,
    sections: [],
    currentSectionIndex: 0,
    currentSection: null,
    subSections: [],
    questionAnswers: [],
    answers: new Map(),
    moduleContentMap: {},
    isLoading: false,
    isSaving: false,
    error: null,
    timeLeft: 0,
    isTimerRunning: false,
    totalQuestions: 0,
    answeredQuestions: 0,
    flaggedQuestions: [],
    completionPercentage: 0,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const loadExamInFlight = useRef(false);
  const loadExamAttemptsRef = useRef<Record<string, number>>({});
  const supabase = createClient();

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  const resolveStudentId = async (): Promise<string | null> => {
    let resolved = studentId || sessionStorage.getItem("studentId");
    if (resolved) return resolved;

    for (let i = 0; i < 10; i++) {
      await wait(150);
      resolved = studentId || sessionStorage.getItem("studentId");
      if (resolved) return resolved;
    }
    return null;
  };

  const normalizeModule = (moduleData: any): RpcModule => ({
    id: moduleData.id,
    module_type: moduleData.module_type,
    heading: moduleData.heading ?? null,
    instruction: moduleData.instruction ?? null,
    sections: (moduleData.sections || []).map((section: any) => ({
      id: section.id,
      title: section.title ?? null,
      instruction: section.instruction ?? null,
      content_text: section.content_text ?? null,
      content_type: section.content_type ?? null,
      // Ensure resource_url is properly handled for audio/image
      resource_url: section.resource_url
        ? section.resource_url.startsWith("http")
          ? section.resource_url
          : `${section.resource_url}`
        : null,
      section_index: section.section_index ?? 0,
      subtext: section.subtext ?? null,
      subsections: (section.sub_sections || section.subsections || []).map(
        (subSection: any, idx: number) => ({
          id: subSection.id,
          content_template: subSection.content_template ?? null,
          sub_type: subSection.sub_type ?? null,
          // Ensure resource_url is properly handled for audio/image
          resource_url: subSection.resource_url
            ? subSection.resource_url.startsWith("http")
              ? subSection.resource_url
              : `${subSection.resource_url}`
            : null,
          boundary_text: subSection.boundary_text ?? null,
          sub_section_index: subSection.sub_section_index ?? idx + 1,
          questions: (subSection.questions || []).map((q: any) => ({
            id: q.id,
            question_ref: q.question_ref,
            options: q.options ?? null,
            marks: q.marks ?? 1,
          })),
        }),
      ),
    })),
  });

  const ensureAttemptModules = async (
    attemptId: string,
    moduleIds: string[],
  ) => {
    if (!moduleIds.length) return;
    const { data: existingAttemptModules, error: attemptModulesError } =
      await supabase
        .from("attempt_modules")
        .select("*")
        .eq("attempt_id", attemptId);

    if (attemptModulesError) throw attemptModulesError;

    const existingModuleIds = (existingAttemptModules || []).map(
      (am) => am.module_id,
    );
    const missingModuleIds = moduleIds.filter(
      (id) => !existingModuleIds.includes(id),
    );

    if (missingModuleIds.length > 0) {
      const recordsToCreate = missingModuleIds.map((moduleId) => ({
        attempt_id: attemptId,
        module_id: moduleId,
        status: "pending",
        time_remaining_seconds: 0,
      }));

      const { error: createError } = await supabase
        .from("attempt_modules")
        .insert(recordsToCreate);

      if (createError) throw createError;
    }
  };

  const formatDbError = (error: any) => {
    if (!error) return "Unknown database error";
    const code = error.code ? ` (code: ${error.code})` : "";
    const hint = error.hint ? ` Hint: ${error.hint}` : "";
    const details = error.details ? ` Details: ${error.details}` : "";
    return `${error.message || "Database error"}${code}${hint}${details}`;
  };

  // Update computed values when answers change
  useEffect(() => {
    const answered = Array.from(state.answers.values()).filter(
      (a) => a.student_response && a.student_response.toString().trim() !== "",
    ).length;

    const flagged = Array.from(state.answers.values())
      .filter((a) => a.is_flagged)
      .map((a) => a.question_ref);

    const completion =
      state.totalQuestions > 0
        ? Math.round((answered / state.totalQuestions) * 100)
        : 0;

    setState((prev) => {
      const flaggedUnchanged =
        prev.flaggedQuestions.length === flagged.length &&
        prev.flaggedQuestions.every((value, index) => value === flagged[index]);

      if (
        prev.answeredQuestions === answered &&
        prev.completionPercentage === completion &&
        flaggedUnchanged
      ) {
        return prev;
      }

      return {
        ...prev,
        answeredQuestions: answered,
        flaggedQuestions: flagged,
        completionPercentage: completion,
      };
    });
  }, [state.answers, state.totalQuestions]);

  // Persist answers to localStorage
  useEffect(() => {
    if (state.attemptId && state.currentModuleId) {
      const key = `exam_${state.attemptId}_${state.currentModuleId}`;
      const answersObj = Object.fromEntries(state.answers);
      localStorage.setItem(key, JSON.stringify(answersObj));
    }
  }, [state.answers, state.attemptId, state.currentModuleId]);

  // Timer logic
  useEffect(() => {
    if (state.isTimerRunning && state.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setState((prev) => {
          const newTime = prev.timeLeft - 1;
          if (newTime <= 0) {
            // Auto-submit when timer expires
            submitModule();
            return { ...prev, timeLeft: 0, isTimerRunning: false };
          }
          return { ...prev, timeLeft: newTime };
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state.isTimerRunning, state.timeLeft]);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async () => {
      await saveProgress();
    }, 2000),
    [state.answers, state.attemptId, state.currentAttemptModule],
  );

  // Load exam data
  const loadExam = useCallback(
    async (attemptId: string) => {
      if (loadExamInFlight.current) return;
      if (state.attemptId === attemptId && state.modules.length > 0) return;

      const maxAttempts = 5;
      const previousAttempts = loadExamAttemptsRef.current[attemptId] || 0;
      if (previousAttempts >= maxAttempts) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Maximum retry limit reached. Please refresh and try again.",
        }));
        return;
      }

      try {
        loadExamInFlight.current = true;
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        let lastError: any = null;

        const resolvedStudentId = await resolveStudentId();
        if (!resolvedStudentId) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "Student identity not available",
          }));
          return;
        }

        for (let attempt = previousAttempts; attempt < maxAttempts; attempt++) {
          loadExamAttemptsRef.current[attemptId] = attempt + 1;
          try {
            const cacheKey = `exam_payload_${attemptId}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
              const parsed = JSON.parse(cached) as RpcExamPayload;
              const hasSections = (parsed.modules || []).some(
                (mod) => (mod.sections || []).length > 0,
              );

              if (!parsed?.modules?.length || !hasSections) {
                localStorage.removeItem(cacheKey);
              } else {
                const moduleContentMap = (parsed.modules || []).reduce(
                  (acc, mod) => {
                    acc[mod.id] = mod.sections || [];
                    return acc;
                  },
                  {} as Record<string, RpcSection[]>,
                );

                const modules = (parsed.modules || []).map((mod) => ({
                  id: mod.id,
                  module_type: mod.module_type,
                  heading: mod.heading ?? null,
                  subheading: null,
                  instruction: mod.instruction ?? null,
                }));

                if (parsed.paper?.id) {
                  sessionStorage.setItem("paperId", parsed.paper.id);
                }

                (parsed.modules || []).forEach((mod) => {
                  sessionStorage.setItem(`${mod.module_type}ModuleId`, mod.id);
                });

                setState((prev) => ({
                  ...prev,
                  attemptId,
                  paperId: parsed.paper?.id || null,
                  modules,
                  moduleContentMap,
                  isLoading: false,
                }));
                loadExamAttemptsRef.current[attemptId] = 0;
                return;
              }
            }

            let payload: RpcExamPayload | null = null;
            let rpcData: any = null;
            let rpcError: any = null;

            ({ data: rpcData, error: rpcError } = await supabase.rpc(
              "get_all_modules_for_attempt",
              {
                p_mock_attempt_id: attemptId,
                p_student_id: resolvedStudentId,
              },
            ));

            if (!rpcError && rpcData?.modules) {
              const modulesArray = [
                rpcData.modules.reading,
                rpcData.modules.listening,
                rpcData.modules.writing,
                rpcData.modules.speaking,
              ]
                .filter(Boolean)
                .map(normalizeModule);

              if (!modulesArray.length) {
                throw new Error("No modules available for this attempt.");
              }

              payload = {
                paper: {
                  id: rpcData.paper_id,
                  title: rpcData.title ?? null,
                  instruction: rpcData.instruction ?? null,
                  paper_type: rpcData.paper_type ?? null,
                },
                modules: modulesArray,
              };
            } else {
              console.warn(
                "RPC fetch failed, building from direct queries:",
                rpcError,
              );

              // Fallback to direct queries if RPC fails
              const { data: attempt, error: attemptError } = await supabase
                .from("mock_attempts")
                .select("*, paper:papers(*)")
                .eq("id", attemptId)
                .single();

              if (attemptError) throw attemptError;

              // Check if paper exists
              if (!attempt.paper || !attempt.paper.id) {
                throw new Error(
                  "This test session does not have an associated paper. Please contact your administrator.",
                );
              }

              const paperId = attempt.paper.id;
              sessionStorage.setItem("paperId", paperId);

              const moduleIds = [
                attempt.paper.reading_module_id,
                attempt.paper.listening_module_id,
                attempt.paper.writing_module_id,
                attempt.paper.speaking_module_id,
              ].filter(Boolean);

              if (moduleIds.length === 0) {
                throw new Error("No modules are linked to this paper.");
              }

              const { data: dbModules, error: modulesError } = await supabase
                .from("modules")
                .select("*")
                .in("id", moduleIds);

              if (modulesError) throw modulesError;

              const { data: sections, error: sectionsError } = await supabase
                .from("sections")
                .select("*")
                .in("module_id", moduleIds)
                .order("section_index");

              if (sectionsError) throw sectionsError;

              const sectionIds = sections?.map((s) => s.id) || [];
              const subSectionsResult = sectionIds.length
                ? await supabase
                    .from("sub_sections")
                    .select("*")
                    .in("section_id", sectionIds)
                : { data: [], error: null };

              if (subSectionsResult.error) throw subSectionsResult.error;

              const subSections = subSectionsResult.data || [];
              const subSectionIds = subSections.map((ss) => ss.id);
              const questionsResult = subSectionIds.length
                ? await supabase
                    .from("question_answers")
                    .select("*")
                    .in("sub_section_id", subSectionIds)
                : { data: [], error: null };

              if (questionsResult.error) throw questionsResult.error;

              const questions = questionsResult.data || [];

              const modulesData = (dbModules || []).map((m) => {
                const moduleSections = (sections || [])
                  .filter((s) => s.module_id === m.id)
                  .map((s) => ({
                    id: s.id,
                    title: s.title,
                    instruction: s.instruction,
                    content_text: s.content_text,
                    content_type: s.content_type,
                    resource_url: s.resource_url,
                    section_index: s.section_index,
                    subtext: s.subtext,
                    subsections: (subSections || [])
                      .filter((ss) => ss.section_id === s.id)
                      .map((ss) => ({
                        id: ss.id,
                        content_template: ss.content_template,
                        sub_type: ss.sub_type,
                        resource_url: ss.resource_url,
                        boundary_text: ss.boundary_text,
                        questions: (questions || [])
                          .filter((q) => q.sub_section_id === ss.id)
                          .map((q) => ({
                            id: q.id,
                            question_ref: q.question_ref,
                            options: q.options,
                            marks: q.marks,
                          })),
                      })),
                  }));

                return {
                  id: m.id,
                  module_type: m.module_type,
                  heading: m.heading,
                  instruction: m.instruction,
                  sections: moduleSections,
                };
              });

              payload = {
                paper: {
                  id: attempt.paper.id,
                  title: attempt.paper.title,
                  instruction: attempt.paper.instruction,
                  paper_type: attempt.paper.paper_type,
                },
                modules: modulesData,
              };
            }

            if (!payload?.modules?.length) {
              throw new Error("No modules available for this attempt.");
            }

            const moduleIds = payload.modules.map((mod) => mod.id);
            await ensureAttemptModules(attemptId, moduleIds);

            const moduleContentMap = (payload.modules || []).reduce(
              (acc, mod) => {
                acc[mod.id] = mod.sections || [];
                return acc;
              },
              {} as Record<string, RpcSection[]>,
            );

            const modules = (payload.modules || []).map((mod) => ({
              id: mod.id,
              module_type: mod.module_type,
              heading: mod.heading ?? null,
              subheading: null,
              instruction: mod.instruction ?? null,
            }));

            (payload.modules || []).forEach((mod) => {
              sessionStorage.setItem(`${mod.module_type}ModuleId`, mod.id);
            });

            // Cache the successful payload
            const payloadCacheKey = `exam_payload_${attemptId}`;
            try {
              localStorage.setItem(payloadCacheKey, JSON.stringify(payload));
            } catch (e) {
              console.warn("Failed to cache exam payload:", e);
            }

            setState((prev) => ({
              ...prev,
              attemptId,
              paperId: payload.paper?.id || null,
              modules,
              moduleContentMap,
              isLoading: false,
            }));
            loadExamAttemptsRef.current[attemptId] = 0;
            return;
          } catch (error: any) {
            lastError = error;
            if (attempt < maxAttempts - 1) {
              await wait(300 * Math.pow(2, attempt));
              continue;
            }
          }
        }

        throw lastError || new Error("Failed to load exam data");
      } catch (error: any) {
        console.error("Error loading exam:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: formatDbError(error),
        }));
      } finally {
        loadExamInFlight.current = false;
      }
    },
    [supabase, state.attemptId, state.modules.length, studentId],
  );

  // Load specific module
  const loadModule = useCallback(
    async (moduleId: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const module = state.modules.find((m) => m.id === moduleId);
        if (!module) throw new Error("Module not found");

        const { data: maybeAttemptModule, error: attemptModuleError } =
          await supabase
            .from("attempt_modules")
            .select("*")
            .eq("attempt_id", state.attemptId!)
            .eq("module_id", moduleId)
            .maybeSingle();

        if (attemptModuleError) throw attemptModuleError;

        let attemptModule = maybeAttemptModule;

        if (!attemptModule) {
          const { data: createdAttemptModule, error: createError } =
            await supabase
              .from("attempt_modules")
              .insert({
                attempt_id: state.attemptId,
                module_id: moduleId,
                status: "pending",
                time_remaining_seconds: 0,
              })
              .select("*")
              .single();

          if (createError) throw createError;
          attemptModule = createdAttemptModule;
        }

        const moduleSections = state.moduleContentMap[moduleId] || [];

        const sections: Section[] = moduleSections.map((section) => ({
          id: section.id,
          module_id: moduleId,
          title: section.title ?? null,
          section_index: section.section_index,
          content_type: section.content_type ?? null,
          resource_url: section.resource_url ?? null,
          content_text: section.content_text ?? null,
          instruction: section.instruction ?? null,
          params: null,
          subtext: section.subtext ?? null,
        }));

        const subSections: SubSection[] = moduleSections.flatMap((section) =>
          (section.subsections || []).map((subSection, index) => ({
            id: subSection.id,
            section_id: section.id,
            title: subSection.sub_type ?? null,
            sub_section_index: index + 1,
            question_type: subSection.sub_type ?? null,
            instruction: null,
            content_template: subSection.content_template ?? null,
            resource_url: subSection.resource_url ?? null,
            boundary_text: subSection.boundary_text ?? null,
            sub_type: subSection.sub_type ?? null,
          })),
        );

        const questionAnswers: QuestionAnswer[] = moduleSections.flatMap(
          (section) =>
            (section.subsections || []).flatMap((subSection) =>
              (subSection.questions || []).map((q) => ({
                id: q.id,
                sub_section_id: subSection.id,
                question_ref: q.question_ref,
                correct_answers: null,
                options: q.options,
                explanation: null,
                marks: q.marks,
              })),
            ),
        );

        // Load existing answers from localStorage or database
        const localKey = `exam_${state.attemptId}_${moduleId}`;
        const localData = localStorage.getItem(localKey);
        let answersMap = new Map<string, Answer>();

        if (localData) {
          const parsed = JSON.parse(localData);
          answersMap = new Map(Object.entries(parsed));
        } else {
          // Load from database
          const { data: studentAnswers } = await supabase
            .from("student_answers")
            .select("*")
            .eq("attempt_module_id", attemptModule.id);

          if (studentAnswers) {
            studentAnswers.forEach((ans) => {
              answersMap.set(`${ans.sub_section_id}_${ans.question_ref}`, {
                question_ref: ans.question_ref,
                sub_section_id: ans.sub_section_id,
                student_response: ans.student_response,
                timestamp: Date.now(),
              });
            });
          }
        }

        // Update attempt_module status to in_progress if pending
        if (attemptModule.status === "pending") {
          await supabase
            .from("attempt_modules")
            .update({
              status: "in_progress",
              started_at: new Date().toISOString(),
            })
            .eq("id", attemptModule.id);

          attemptModule.status = "in_progress";
          attemptModule.started_at = new Date().toISOString();
        }

        setState((prev) => ({
          ...prev,
          currentModuleId: moduleId,
          currentModule: module,
          currentAttemptModule: attemptModule,
          sections: sections || [],
          currentSectionIndex: 0,
          currentSection: sections?.[0] || null,
          subSections: subSections || [],
          questionAnswers: questionAnswers || [],
          answers: answersMap,
          totalQuestions: questionAnswers?.length || 0,
          isLoading: false,
        }));
      } catch (error: any) {
        console.error("Error loading module:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
      }
    },
    [state.modules, state.attemptId, state.moduleContentMap, supabase],
  );

  // Set current section
  const setCurrentSection = (index: number) => {
    if (index >= 0 && index < state.sections.length) {
      setState((prev) => ({
        ...prev,
        currentSectionIndex: index,
        currentSection: prev.sections[index],
      }));
    }
  };

  // Submit answer
  const submitAnswer = (
    questionRef: string,
    subSectionId: string,
    response: string | string[],
  ) => {
    const key = `${subSectionId}_${questionRef}`;
    const newAnswers = new Map(state.answers);

    newAnswers.set(key, {
      question_ref: questionRef,
      sub_section_id: subSectionId,
      student_response: response,
      timestamp: Date.now(),
      is_flagged: newAnswers.get(key)?.is_flagged || false,
    });

    setState((prev) => ({ ...prev, answers: newAnswers }));
    debouncedSave();
  };

  // Toggle flag
  const toggleFlag = (questionRef: string, subSectionId: string) => {
    const key = `${subSectionId}_${questionRef}`;
    const newAnswers = new Map(state.answers);
    const existing = newAnswers.get(key);

    if (existing) {
      existing.is_flagged = !existing.is_flagged;
      newAnswers.set(key, existing);
    } else {
      newAnswers.set(key, {
        question_ref: questionRef,
        sub_section_id: subSectionId,
        student_response: "",
        timestamp: Date.now(),
        is_flagged: true,
      });
    }

    setState((prev) => ({ ...prev, answers: newAnswers }));
  };

  // Start timer
  const startTimer = (durationMinutes: number) => {
    setState((prev) => ({
      ...prev,
      timeLeft: durationMinutes * 60,
      isTimerRunning: true,
    }));
  };

  // Stop timer
  const stopTimer = () => {
    setState((prev) => ({ ...prev, isTimerRunning: false }));
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Save progress to database
  const saveProgress = async () => {
    if (!state.currentAttemptModule || state.answers.size === 0) return;

    try {
      setState((prev) => ({ ...prev, isSaving: true }));

      const answersToSave = Array.from(state.answers.values()).map((ans) => ({
        attempt_module_id: state.currentAttemptModule!.id,
        sub_section_id: ans.sub_section_id,
        question_ref: ans.question_ref,
        student_response: JSON.stringify(ans.student_response),
      }));

      // Upsert answers
      const { error } = await supabase
        .from("student_answers")
        .upsert(answersToSave, {
          onConflict: "attempt_module_id,sub_section_id,question_ref",
        });

      if (error) throw error;

      setState((prev) => ({ ...prev, isSaving: false }));
    } catch (error: any) {
      console.error("Error saving progress:", error);
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // Submit module
  const submitModule = async (): Promise<{
    success: boolean;
    totalScore?: number;
    maxScore?: number;
    bandScore?: number;
    error?: string;
  }> => {
    if (!state.currentAttemptModule) {
      return { success: false, error: "No module loaded" };
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true }));

      // Import the submitModule helper
      const { submitModule: submitModuleHelper } =
        await import("@/helpers/answers");

      // Save final answers first
      await saveProgress();

      // Submit and evaluate
      const result = await submitModuleHelper(state.currentAttemptModule.id);

      if (!result.success) {
        throw new Error(result.error || "Failed to submit module");
      }

      // Update attempt_module status locally
      const { error: updateError } = await supabase
        .from("attempt_modules")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          band_score: result.bandScore || null,
        })
        .eq("id", state.currentAttemptModule.id);

      if (updateError) throw updateError;

      // Clear localStorage
      const key = `exam_${state.attemptId}_${state.currentModuleId}`;
      localStorage.removeItem(key);

      stopTimer();

      setState((prev) => ({ ...prev, isLoading: false }));

      return result;
    } catch (error: any) {
      console.error("Error submitting module:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
      return {
        success: false,
        error: error.message,
      };
    }
  };

  return (
    <ExamContext.Provider
      value={{
        ...state,
        loadExam,
        loadModule,
        setCurrentSection,
        submitAnswer,
        toggleFlag,
        startTimer,
        stopTimer,
        submitModule,
        saveProgress,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
}

export function useExam() {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error("useExam must be used within ExamProvider");
  }
  return context;
}
