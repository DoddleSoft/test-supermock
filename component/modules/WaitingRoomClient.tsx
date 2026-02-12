"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  CheckCircle,
  Clock,
  ChevronRight,
  Lock,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

interface WaitingRoomClientProps {
  attemptId: string;
  centerSlug: string;
  modules: Array<{
    id: string;
    module_type: "reading" | "listening" | "writing" | "speaking";
    heading: string | null;
    subheading: string | null;
    instruction: string | null;
  }>;
}

interface ModuleStatus {
  module_id: string;
  status: "pending" | "not_started" | "in_progress" | "completed";
}

export default function WaitingRoomClient({
  attemptId,
  centerSlug,
  modules,
}: WaitingRoomClientProps) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [moduleStatuses, setModuleStatuses] = useState<Record<string, string>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch module statuses from database
  useEffect(() => {
    const fetchModuleStatuses = async () => {
      try {
        const supabase = createClient();

        console.log(
          "[WaitingRoom] Fetching module statuses for attempt:",
          attemptId,
        );

        // Fetch all attempt_modules for this attempt (created by join_mock_test RPC)
        const { data, error } = await supabase
          .from("attempt_modules")
          .select("module_id, status, module_type")
          .eq("attempt_id", attemptId)
          .order("module_type");

        if (error) {
          console.error("[WaitingRoom] Database error:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            attemptId,
          });

          setHasError(true);
          setErrorMessage(
            "Failed to load test data. Please refresh the page or contact support.",
          );
          setIsLoading(false);
          return;
        }

        // Critical validation: Modules MUST exist (created by join_mock_test RPC)
        if (!data || data.length === 0) {
          console.error(
            "[WaitingRoom] CRITICAL: No attempt_modules found for attempt:",
            attemptId,
          );
          console.error(
            "[WaitingRoom] This means join_mock_test RPC failed to create modules",
          );
          console.error(
            "[WaitingRoom] Check if:",
            "\n  1. join_mock_test.sql is deployed to database",
            "\n  2. Paper has modules assigned (listening/reading/writing)",
            "\n  3. RPC executed successfully during OTP validation",
          );

          // Try to get info from sessionStorage as fallback
          const storedModules = sessionStorage.getItem("moduleIds");
          if (storedModules) {
            console.warn(
              "[WaitingRoom] Found modules in sessionStorage but not in database:",
              storedModules,
            );
          }

          setHasError(true);
          setErrorMessage(
            "Test modules not found. The test may not have been set up correctly. Please try joining again or contact support with attempt ID: " +
              attemptId,
          );
          setIsLoading(false);
          return;
        }

        // Build status map (module_id -> status)
        const statusMap: Record<string, string> = {};
        data.forEach((item: ModuleStatus & { module_type?: string }) => {
          statusMap[item.module_id] = item.status;
        });

        console.log("[WaitingRoom] Module statuses loaded successfully:", {
          attemptId,
          modulesFound: data.length,
          moduleTypes: data.map((m: any) => m.module_type).join(", "),
          statuses: data.map((m: any) => `${m.module_type}:${m.status}`),
        });

        setModuleStatuses(statusMap);

        // Check if ALL modules are completed - if so, redirect to hub
        const allCompleted = data.every((m: ModuleStatus) => m.status === "completed");
        if (allCompleted && data.length > 0) {
          console.log("[WaitingRoom] All modules completed, redirecting to hub page");
          setTimeout(() => {
            router.push(`/mock-test/${centerSlug}`);
          }, 1500);
        }
      } catch (error) {
        console.error("[WaitingRoom] Unexpected error:", error);
        setHasError(true);
        setErrorMessage("An unexpected error occurred. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchModuleStatuses();

    // Slight delay for smooth transition
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [attemptId, router, centerSlug]);

  const getModuleIcon = (type: string) => {
    switch (type) {
      case "reading":
        return <BookOpen className="h-6 w-6" />;
      case "listening":
        return <Headphones className="h-6 w-6" />;
      case "writing":
        return <PenTool className="h-6 w-6" />;
      case "speaking":
        return <Mic className="h-6 w-6" />;
      default:
        return null;
    }
  };

  const getModuleColor = (type: string) => {
    switch (type) {
      case "reading":
        return "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700";
      case "listening":
        return "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700";
      case "writing":
        return "from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700";
      case "speaking":
        return "from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700";
      default:
        return "from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700";
    }
  };

  const handleStartModule = (
    moduleId: string,
    moduleType: string,
    status?: string,
  ) => {
    // Don't allow navigation to completed modules
    if (status === "completed") {
      console.log(
        `[WaitingRoom] Module ${moduleType} is completed, cannot re-enter`,
      );
      return;
    }

    console.log(
      `[WaitingRoom] Navigating to ${moduleType} module (status: ${status || "pending"})`,
    );

    // Navigate to module-specific route
    router.push(`/mock-test/${centerSlug}/${attemptId}/${moduleType}`);
  };

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <Clock className="w-8 h-8 text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Preparing Your Test
            </h2>
            <p className="text-gray-600 mb-6">Loading test modules...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if modules weren't created properly
  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Test Setup Error
            </h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => router.push(`/mock-test/${centerSlug}`)}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all duration-200"
            >
              Return to Tests
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl px-8 py-4 pt-12 w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <p className="text-gray-600 font-semibold text-lg">
            Select a module to begin your IELTS mock test
          </p>
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module) => {
            const status = moduleStatuses[module.id];
            const isCompleted = status === "completed";
            const isInProgress = status === "in_progress";

            return (
              <button
                key={module.id}
                onClick={() =>
                  handleStartModule(module.id, module.module_type, status)
                }
                disabled={isCompleted}
                className={`group relative overflow-hidden rounded-xl border-2 bg-white p-6 text-left transition-all duration-300 ${
                  isCompleted
                    ? "border-gray-300 opacity-60 cursor-not-allowed"
                    : "border-gray-200 hover:shadow-xl hover:border-transparent hover:-translate-y-1"
                }`}
              >
                {/* Background Gradient on Hover (only if not completed) */}
                {!isCompleted && (
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${getModuleColor(module.module_type)} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />
                )}

                {/* Completed Badge */}
                {isCompleted && (
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                    <CheckCircle className="w-3 h-3" />
                    Completed
                  </div>
                )}

                {/* In Progress Badge */}
                {isInProgress && !isCompleted && (
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                    <Clock className="w-3 h-3" />
                    In Progress
                  </div>
                )}

                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-lg bg-opacity-20 transition-colors ${
                        module.module_type === "reading"
                          ? "bg-green-500"
                          : module.module_type === "listening"
                            ? "bg-blue-500"
                            : module.module_type === "writing"
                              ? "bg-purple-500"
                              : "bg-orange-500"
                      } ${isCompleted ? "opacity-50" : "group-hover:bg-white/30"}`}
                    >
                      <span
                        className={`transition-colors ${
                          isCompleted
                            ? "text-gray-500"
                            : module.module_type === "reading"
                              ? "text-green-700 group-hover:text-white"
                              : module.module_type === "listening"
                                ? "text-blue-700 group-hover:text-white"
                                : module.module_type === "writing"
                                  ? "text-purple-700 group-hover:text-white"
                                  : "text-orange-700 group-hover:text-white"
                        }`}
                      >
                        {isCompleted ? (
                          <Lock className="h-6 w-6 text-gray-900" />
                        ) : (
                          getModuleIcon(module.module_type)
                        )}
                      </span>
                    </div>
                    {!isCompleted && (
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                    )}
                  </div>

                  <h3
                    className={`text-xl font-bold mb-2 transition-colors ${
                      isCompleted
                        ? "text-gray-500"
                        : "text-gray-900 group-hover:text-white"
                    }`}
                  >
                    {module.module_type.charAt(0).toUpperCase() +
                      module.module_type.slice(1)}{" "}
                    Test
                  </h3>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-8 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Once you start a module, the timer will begin
            automatically. Completed modules are locked and cannot be
            re-attempted.
          </p>
        </div>
      </div>
    </div>
  );
}
