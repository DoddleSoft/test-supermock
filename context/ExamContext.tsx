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
  centerSlug: string | null;

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
  showSubmitDialog: boolean;
  submitDialogMessage: string | null;

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
    nextModuleUrl?: string;
  }>;
  saveProgress: () => Promise<void>;
  dismissSubmitDialog: () => void;
  getNextModuleUrl: () => string | null;
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

interface ExamProviderProps {
  children: React.ReactNode;
  attemptId?: string;
  studentId?: string;
  paperId?: string;
  centerSlug?: string;
  serverData?: {
    // Make these optional so it handles both structures
    paper?: any;
    modules?: Record<string, any>;
    // Add these to match what page.tsx is sending
    paperData?: {
      modules?: Record<string, any>;
      [key: string]: any;
    };
    attemptData?: any;
  };
}

export function ExamProvider({
  children,
  attemptId: initialAttemptId,
  studentId: initialStudentId,
  paperId: initialPaperId,
  centerSlug: initialCenterSlug,
  serverData,
}: ExamProviderProps) {
  const { studentId: authStudentId } = useAuth();

  // Use initial values from props or auth context
  const resolvedStudentId = initialStudentId || authStudentId;

  // Initialize state with server data if available
  const [state, setState] = useState<ExamState>(() => {
    if (serverData && initialAttemptId && initialPaperId) {
      // Transform server data to module format
      const modulesArray = Object.values(
        serverData.modules || serverData.paperData?.modules || {},
      ).map((module: any) => ({
        id: module.id,
        module_type: module.module_type,
        heading: module.heading ?? null,
        subheading: module.subheading ?? null,
        instruction: module.instruction ?? null,
      }));

      // Build module content map
      const contentMap: Record<string, RpcSection[]> = {};
      Object.values(
        serverData.modules || serverData.paperData?.modules || {},
      ).forEach((module: any) => {
        contentMap[module.id] = (module.sections || []).map((section: any) => ({
          id: section.id,
          title: section.title ?? null,
          instruction: section.instruction ?? null,
          content_text: section.content_text ?? null,
          content_type: section.content_type ?? null,
          resource_url: section.resource_url ?? null,
          section_index: section.section_index ?? 0,
          subtext: section.subtext ?? null,
          subsections: (section.sub_sections || []).map((subSection: any) => ({
            id: subSection.id,
            content_template: subSection.content_template ?? null,
            sub_type: subSection.sub_type ?? null,
            resource_url: subSection.resource_url ?? null,
            boundary_text: subSection.boundary_text ?? null,
            sub_section_index: subSection.sub_section_index ?? 0,
            questions: (subSection.questions || []).map((q: any) => ({
              id: q.id,
              question_ref: q.question_ref,
              options: q.options ?? null,
              marks: q.marks ?? 1,
            })),
          })),
        }));
      });

      return {
        attemptId: initialAttemptId,
        paperId: initialPaperId,
        centerSlug: initialCenterSlug || null,
        modules: modulesArray,
        currentModuleId: null,
        currentModule: null,
        currentAttemptModule: null,
        sections: [],
        currentSectionIndex: 0,
        currentSection: null,
        subSections: [],
        questionAnswers: [],
        answers: new Map(),
        moduleContentMap: contentMap,
        isLoading: false,
        isSaving: false,
        error: null,
        showSubmitDialog: false,
        submitDialogMessage: null,
        timeLeft: 0,
        isTimerRunning: false,
        totalQuestions: 0,
        answeredQuestions: 0,
        flaggedQuestions: [],
        completionPercentage: 0,
      };
    }

    return {
      attemptId: null,
      paperId: null,
      centerSlug: null,
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
      showSubmitDialog: false,
      submitDialogMessage: null,
      timeLeft: 0,
      isTimerRunning: false,
      totalQuestions: 0,
      answeredQuestions: 0,
      flaggedQuestions: [],
      completionPercentage: 0,
    };
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const loadExamInFlight = useRef(false);
  const loadExamAttemptsRef = useRef<Record<string, number>>({});
  const loadedModulesRef = useRef<Set<string>>(new Set());
  const supabase = createClient();

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

  const resolveStudentId = async (): Promise<string | null> => {
    // Use the resolved student ID from props if available
    if (resolvedStudentId) {
      sessionStorage.setItem("studentId", resolvedStudentId);
      return resolvedStudentId;
    }

    let resolved = sessionStorage.getItem("studentId");
    if (resolved) return resolved;

    for (let i = 0; i < 10; i++) {
      await wait(150);
      resolved = authStudentId || sessionStorage.getItem("studentId");
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

  // --- MOVED UP: Save progress to database (Must be defined before use in debouncedSave and submitModule) ---
  const saveProgress = useCallback(async () => {
    if (!state.currentAttemptModule || state.answers.size === 0) return;

    try {
      setState((prev) => ({ ...prev, isSaving: true }));

      const answersToSave = Array.from(state.answers.values()).map((ans) => ({
        attempt_module_id: state.currentAttemptModule!.id,
        reference_id: ans.sub_section_id,
        question_ref: ans.question_ref,
        student_response:
          typeof ans.student_response === "string"
            ? ans.student_response
            : JSON.stringify(ans.student_response),
      }));

      // Batch upsert all answers in one query
      const { error } = await supabase
        .from("student_answers")
        .upsert(answersToSave, {
          onConflict: "attempt_module_id,reference_id,question_ref",
        });

      if (error) throw error;

      setState((prev) => ({ ...prev, isSaving: false }));
    } catch (error: any) {
      console.error("Error saving progress:", error);
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  }, [state.currentAttemptModule, state.answers, supabase]);

  // Debounced save function (Now saveProgress is defined)
  const debouncedSave = useCallback(
    debounce(async () => {
      await saveProgress();
    }, 2000),
    [saveProgress],
  );

  // --- MOVED UP: Submit module (Must be defined before use in Timer useEffect) ---
  const submitModule = useCallback(
    async (
      autoSubmit: boolean = false,
    ): Promise<{
      success: boolean;
      totalScore?: number;
      maxScore?: number;
      bandScore?: number;
      error?: string;
      nextModuleUrl?: string;
    }> => {
      if (!state.currentAttemptModule) {
        return { success: false, error: "No module loaded" };
      }

      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        // 1. Final sync of timer to database
        await supabase
          .from("attempt_modules")
          .update({
            time_remaining_seconds: state.timeLeft,
          })
          .eq("id", state.currentAttemptModule.id);

        // 2. Batch insert all answers to database
        if (state.answers.size > 0) {
          const answersToSave = Array.from(state.answers.values()).map(
            (ans) => ({
              attempt_module_id: state.currentAttemptModule!.id,
              reference_id: ans.sub_section_id,
              question_ref: ans.question_ref,
              student_response:
                typeof ans.student_response === "string"
                  ? ans.student_response
                  : JSON.stringify(ans.student_response),
            }),
          );

          const { error: answersError } = await supabase
            .from("student_answers")
            .upsert(answersToSave, {
              onConflict: "attempt_module_id,reference_id,question_ref",
            });

          if (answersError) throw answersError;
        }

        // 3. Call backend grading API for automatic evaluation
        const gradingResponse = await fetch("/api/grading", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptModuleId: state.currentAttemptModule.id,
          }),
        });

        if (!gradingResponse.ok) {
          throw new Error("Grading API failed");
        }

        const result = await gradingResponse.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to grade module");
        }

        // 4. Update attempt_module status to completed
        const { error: updateError } = await supabase
          .from("attempt_modules")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            band_score: result.bandScore || null,
            score_obtained: result.totalScore || 0,
            time_remaining_seconds: 0,
          })
          .eq("id", state.currentAttemptModule.id);

        if (updateError) throw updateError;

        // 5. Determine next module URL
        const currentModuleType = state.currentModule?.module_type;
        const moduleOrder = ["listening", "reading", "writing", "speaking"];
        const currentIndex = moduleOrder.indexOf(currentModuleType || "");
        let nextModuleUrl: string | null = null;

        if (currentIndex >= 0 && currentIndex < moduleOrder.length - 1) {
          const nextModuleType = moduleOrder[currentIndex + 1];
          const nextModule = state.modules.find(
            (m) => m.module_type === nextModuleType,
          );
          if (nextModule && state.centerSlug && state.attemptId) {
            nextModuleUrl = `/mock-test/${state.centerSlug}/${state.attemptId}/${nextModuleType}`;
          }
        }

        // 6. Clear localStorage for this module
        const localKey = `exam_${state.attemptId}_${state.currentModuleId}`;
        localStorage.removeItem(localKey);

        // Clear answer storage
        if (state.attemptId) {
          const answerStorageKey = `exam_answers_${state.attemptId}`;
          localStorage.removeItem(answerStorageKey);
        }

        // 7. Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        // 8. Show dialog if auto-submitted
        const dialogMessage = autoSubmit
          ? "Time's up! Your answers have been submitted to the center for evaluation."
          : null;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isTimerRunning: false,
          answers: new Map(), // Clear answers from state
          showSubmitDialog: autoSubmit,
          submitDialogMessage: dialogMessage,
        }));

        return { ...result, nextModuleUrl: nextModuleUrl || undefined };
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
    },
    [
      state.currentAttemptModule,
      state.attemptId,
      state.currentModuleId,
      state.currentModule,
      state.modules,
      state.centerSlug,
      state.answers,
      state.timeLeft,
      supabase,
    ],
  );

  // Timer logic with database sync
  useEffect(() => {
    if (state.isTimerRunning && state.timeLeft > 0) {
      let tickCount = 0;
      const SYNC_INTERVAL = 30; // Sync to DB every 30 seconds to reduce load

      timerRef.current = setInterval(() => {
        setState((prev) => {
          const newTime = prev.timeLeft - 1;
          tickCount++;

          // Sync to database every SYNC_INTERVAL seconds
          if (tickCount >= SYNC_INTERVAL && prev.currentAttemptModule?.id) {
            tickCount = 0;
            // Async update without blocking
            supabase
              .from("attempt_modules")
              .update({
                time_remaining_seconds: newTime,
                time_spent_seconds:
                  (prev.currentAttemptModule.time_spent_seconds || 0) +
                  SYNC_INTERVAL,
              })
              .eq("id", prev.currentAttemptModule.id)
              .then(({ error }) => {
                if (error) console.error("Timer sync error:", error);
              });
          }

          if (newTime <= 0) {
            // Auto-submit when timer expires
            submitModule(true);
            return { ...prev, timeLeft: 0, isTimerRunning: false };
          }
          return { ...prev, timeLeft: newTime };
        });
      }, 1000);
    }

    // Cleanup: sync final time to database on unmount or timer stop
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);

        // Final sync to database
        if (state.currentAttemptModule?.id && state.timeLeft > 0) {
          supabase
            .from("attempt_modules")
            .update({
              time_remaining_seconds: state.timeLeft,
              time_spent_seconds:
                state.currentAttemptModule.time_spent_seconds || 0,
            })
            .eq("id", state.currentAttemptModule.id)
            .then(({ error }) => {
              if (error) console.error("Final timer sync error:", error);
            });
        }
      }
    };
  }, [
    state.isTimerRunning,
    state.currentAttemptModule?.id,
    submitModule,
    supabase,
  ]);

  // Load exam data (Fixed broken syntax and missing closing blocks)
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

            // Use new load_paper_with_modules RPC
            const { data: paperData, error: paperError } = await supabase.rpc(
              "load_paper_with_modules",
              { p_paper_id: sessionStorage.getItem("paperId") },
            );

            if (paperError || !paperData) {
              throw new Error(
                `Failed to load exam modules. ${paperError?.message || "No data returned from server."}`,
              );
            }

            // Check for modules
            const modulesObj = paperData.modules || {};
            const modulesArray = [
              modulesObj.reading,
              modulesObj.listening,
              modulesObj.writing,
              modulesObj.speaking,
            ]
              .filter(Boolean)
              .map(normalizeModule);

            if (!modulesArray.length) {
              setState((prev) => ({
                ...prev,
                isLoading: false,
                error:
                  "No modules available for this exam. Please contact your administrator.",
              }));
              return;
            }

            const moduleIds = modulesArray.map((mod) => mod.id);
            await ensureAttemptModules(attemptId, moduleIds);

            const moduleContentMap = modulesArray.reduce(
              (acc, mod) => {
                acc[mod.id] = mod.sections || [];
                return acc;
              },
              {} as Record<string, RpcSection[]>,
            );

            const modules = modulesArray.map((mod) => ({
              id: mod.id,
              module_type: mod.module_type,
              heading: mod.heading ?? null,
              subheading: null,
              instruction: mod.instruction ?? null,
            }));

            modulesArray.forEach((mod) => {
              sessionStorage.setItem(`${mod.module_type}ModuleId`, mod.id);
            });

            // Cache the successful payload
            const payloadCacheKey = `exam_payload_${attemptId}`;
            try {
              localStorage.setItem(
                payloadCacheKey,
                JSON.stringify({
                  paper: paperData.paper,
                  modules: modulesArray,
                }),
              );
            } catch (e) {
              console.warn("Failed to cache exam payload:", e);
            }

            setState((prev) => ({
              ...prev,
              attemptId,
              paperId: paperData.paper?.id || null,
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
    [supabase, state.attemptId, state.modules.length, resolvedStudentId],
  );

  // Get module duration based on type
  const getModuleDuration = (moduleType: string): number => {
    switch (moduleType) {
      case "listening":
        return 30 * 60; // 30 minutes in seconds
      case "reading":
        return 60 * 60; // 60 minutes in seconds
      case "writing":
        return 60 * 60; // 60 minutes in seconds
      case "speaking":
        return 15 * 60; // 15 minutes in seconds
      default:
        return 60 * 60; // Default 60 minutes
    }
  };

  // Load specific module
  const loadModule = useCallback(
    async (moduleId: string) => {
      try {
        // Check if module is already loaded to avoid duplicate loads
        if (
          loadedModulesRef.current.has(moduleId) &&
          state.currentModuleId === moduleId
        ) {
          console.log(
            "[loadModule] Module already loaded, skipping:",
            moduleId,
          );
          return;
        }

        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        const module = state.modules.find((m) => m.id === moduleId);
        if (!module) throw new Error("Module not found");

        // Only query attempt_modules ONCE per module load
        const { data: maybeAttemptModule, error: attemptModuleError } =
          await supabase
            .from("attempt_modules")
            .select("*")
            .eq("attempt_id", state.attemptId!)
            .eq("module_id", moduleId)
            .maybeSingle();

        if (attemptModuleError) throw attemptModuleError;

        let attemptModule = maybeAttemptModule;
        const moduleDuration = getModuleDuration(module.module_type);

        if (!attemptModule) {
          // Create new attempt_module with proper initial time
          const { data: createdAttemptModule, error: createError } =
            await supabase
              .from("attempt_modules")
              .insert({
                attempt_id: state.attemptId,
                module_id: moduleId,
                status: "pending",
                time_remaining_seconds: moduleDuration,
                time_spent_seconds: 0,
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

        // Debug: Log question options to verify they're loaded
        console.log(
          "[loadModule] Question answers with options:",
          questionAnswers.slice(0, 5).map((qa) => ({
            ref: qa.question_ref,
            hasOptions: !!qa.options,
            optionsCount: qa.options?.length || 0,
            firstOption: qa.options?.[0],
          })),
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
          const now = new Date().toISOString();
          await supabase
            .from("attempt_modules")
            .update({
              status: "in_progress",
              started_at: now,
            })
            .eq("id", attemptModule.id);

          attemptModule.status = "in_progress";
          attemptModule.started_at = now;
        }

        // Initialize timer with remaining time from database
        const timeToSet =
          attemptModule.time_remaining_seconds || moduleDuration;

        // Mark module as loaded to prevent duplicate loads
        loadedModulesRef.current.add(moduleId);

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
          timeLeft: timeToSet,
          isTimerRunning: attemptModule.status === "in_progress",
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
    [
      state.modules,
      state.attemptId,
      state.moduleContentMap,
      state.currentModuleId,
      supabase,
    ],
  );

  // Set current section
  const setCurrentSection = useCallback((index: number) => {
    setState((prev) => {
      if (index >= 0 && index < prev.sections.length) {
        return {
          ...prev,
          currentSectionIndex: index,
          currentSection: prev.sections[index],
        };
      }
      return prev;
    });
  }, []); // No dependencies needed due to functional update
  // Submit answer
  const submitAnswer = useCallback(
    (
      questionRef: string,
      subSectionId: string,
      response: string | string[],
    ) => {
      // Use functional update to access the *current* answers without adding state.answers to dependency array
      setState((prev) => {
        const key = `${subSectionId}_${questionRef}`;
        const newAnswers = new Map(prev.answers); // Create copy from prev state

        newAnswers.set(key, {
          question_ref: questionRef,
          sub_section_id: subSectionId,
          student_response: response,
          timestamp: Date.now(),
          is_flagged: newAnswers.get(key)?.is_flagged || false,
        });

        return { ...prev, answers: newAnswers };
      });

      debouncedSave();
    },
    [debouncedSave], // Only depends on the debounced function
  );

  // Toggle flag
  const toggleFlag = useCallback(
    (questionRef: string, subSectionId: string) => {
      setState((prev) => {
        const key = `${subSectionId}_${questionRef}`;
        const newAnswers = new Map(prev.answers);
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

        return { ...prev, answers: newAnswers };
      });
    },
    [],
  );

  // Start timer
  const startTimer = useCallback((durationMinutes: number) => {
    setState((prev) => ({
      ...prev,
      timeLeft: durationMinutes * 60,
      isTimerRunning: true,
    }));
  }, []);

  // Stop timer
  const stopTimer = useCallback(() => {
    setState((prev) => ({ ...prev, isTimerRunning: false }));
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, []);

  // Dismiss submit dialog
  const dismissSubmitDialog = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showSubmitDialog: false,
      submitDialogMessage: null,
    }));
  }, []);

  // Get next module URL
  const getNextModuleUrl = useCallback((): string | null => {
    const currentModuleType = state.currentModule?.module_type;
    const moduleOrder = ["listening", "reading", "writing", "speaking"];
    const currentIndex = moduleOrder.indexOf(currentModuleType || "");

    if (currentIndex >= 0 && currentIndex < moduleOrder.length - 1) {
      const nextModuleType = moduleOrder[currentIndex + 1];
      const nextModule = state.modules.find(
        (m) => m.module_type === nextModuleType,
      );
      if (nextModule && state.centerSlug && state.attemptId) {
        return `/mock-test/${state.centerSlug}/${state.attemptId}/${nextModuleType}`;
      }
    }
    return null;
  }, [state.currentModule, state.modules, state.centerSlug, state.attemptId]);

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
        dismissSubmitDialog,
        getNextModuleUrl,
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
