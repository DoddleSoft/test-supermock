"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExamProvider, useExam } from "@/context/ExamContext";
import { Loader } from "@/component/ui/loader";
import { toast } from "sonner";
import {
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  CheckCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Flag,
} from "lucide-react";
import { CentreProvider } from "@/context/CenterContext";

function WaitingRoom() {
  const router = useRouter();
  const params = useParams();
  const { modules, isLoading, error, loadExam } = useExam();

  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const lastAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    const attemptId = params.id as string;
    if (!attemptId) {
      toast.error("Invalid test session");
      router.push("/mock-test");
      return;
    }

    // Prevent duplicate loads
    if (lastAttemptRef.current === attemptId) {
      return;
    }
    lastAttemptRef.current = attemptId;

    // Load exam data
    const init = async () => {
      try {
        setLoadingProgress(25);
        await loadExam(attemptId);
        setLoadingProgress(100);

        // Slight delay for smooth transition
        setTimeout(() => {
          setIsReady(true);
        }, 500);
      } catch (err) {
        console.error("Failed to load exam:", err);
        // Don't call toast here if error is already set in context
        // The error state will be displayed by the error UI
      }
    };

    init();
  }, [params.id]); // Removed loadExam and router from dependencies to prevent loops

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

  const handleStartModule = (moduleId: string, moduleType: string) => {
    const centerSlug = params.slug as string;
    const attemptId = params.id as string;

    // Navigate to module-specific route
    router.push(`/mock-test/${centerSlug}/${attemptId}/${moduleType}`);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Failed to Load Test
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/mock-test/${params.slug}`)}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200"
          >
            Return to Tests
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
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
            <p className="text-gray-600 mb-6">
              Loading modules and questions...
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>

            <p className="text-sm text-gray-500">{loadingProgress}%</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Ready!</h1>
          <p className="text-gray-600">
            Select a module to begin your IELTS mock test
          </p>
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => handleStartModule(module.id, module.module_type)}
              className={`group relative overflow-hidden rounded-xl border-2 border-gray-200 bg-white p-6 text-left transition-all duration-300 hover:shadow-xl hover:border-transparent hover:-translate-y-1`}
            >
              {/* Background Gradient on Hover */}
              <div
                className={`absolute inset-0 bg-gradient-to-r ${getModuleColor(module.module_type)} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />

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
                    } group-hover:bg-white/30`}
                  >
                    <span
                      className={`transition-colors ${
                        module.module_type === "reading"
                          ? "text-green-700 group-hover:text-white"
                          : module.module_type === "listening"
                            ? "text-blue-700 group-hover:text-white"
                            : module.module_type === "writing"
                              ? "text-purple-700 group-hover:text-white"
                              : "text-orange-700 group-hover:text-white"
                      }`}
                    >
                      {getModuleIcon(module.module_type)}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 group-hover:text-white mb-2 transition-colors">
                  {module.module_type.charAt(0).toUpperCase() +
                    module.module_type.slice(1)}{" "}
                  Test
                </h3>

                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-gray-600 group-hover:text-white/90 transition-colors">
                    <Clock className="w-4 h-4" />
                    60 min
                  </span>
                  <span className="text-gray-400 group-hover:text-white/70 transition-colors">
                    •
                  </span>
                  <span className="text-gray-600 group-hover:text-white/90 transition-colors capitalize">
                    {module.module_type}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Once you start a module, the timer will begin
            automatically. Make sure you're ready before clicking.
          </p>
        </div>
      </div>
    </div>
  );
}

// Remove duplicate exports and ExamContent function
// The WaitingRoom component handles module selection and exam preparation

function ExamContent() {
  const router = useRouter();
  const {
    modules,
    currentModule,
    sections,
    currentSectionIndex,
    currentSection,
    timeLeft,
    completionPercentage,
    answeredQuestions,
    totalQuestions,
    flaggedQuestions,
    isLoading,
    error,
    loadModule,
    setCurrentSection,
    startTimer,
    stopTimer,
    submitModule,
  } = useExam();

  const [showModuleSelector, setShowModuleSelector] = useState(!currentModule);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getModuleIcon = (type: string) => {
    switch (type) {
      case "reading":
        return <BookOpen className="h-5 w-5" />;
      case "listening":
        return <Headphones className="h-5 w-5" />;
      case "writing":
        return <PenTool className="h-5 w-5" />;
      case "speaking":
        return <Mic className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getModuleColor = (type: string) => {
    switch (type) {
      case "reading":
        return "bg-green-100 text-green-700 border-green-200";
      case "listening":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "writing":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "speaking":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const handleModuleSelect = async (moduleId: string) => {
    try {
      await loadModule(moduleId);
      setShowModuleSelector(false);
      // Start timer based on module type (you can adjust durations)
      const module = modules.find((m) => m.id === moduleId);
      if (module) {
        let duration = 60; // default
        switch (module.module_type) {
          case "reading":
            duration = 60;
            break;
          case "listening":
            duration = 30;
            break;
          case "writing":
            duration = 60;
            break;
          case "speaking":
            duration = 15;
            break;
        }
        startTimer(duration);
      }
    } catch (err) {
      toast.error("Failed to load module");
    }
  };

  const handleSubmit = async () => {
    const confirmed = confirm(
      "Are you sure you want to submit this module? You cannot change your answers after submission.",
    );
    if (confirmed) {
      try {
        const result = await submitModule();

        if (result.success && result.totalScore !== undefined) {
          toast.success(
            `Module submitted! Score: ${result.totalScore}/${result.maxScore}${result.bandScore ? ` (Band ${result.bandScore})` : ""}`,
          );
        } else {
          toast.success("Module submitted successfully!");
        }

        setShowModuleSelector(true);
        stopTimer();
      } catch (err) {
        toast.error("Failed to submit module. Please try again.");
      }
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSection(currentSectionIndex - 1);
    }
  };

  const handleNextSection = () => {
    if (currentSectionIndex < sections.length - 1) {
      setCurrentSection(currentSectionIndex + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Exam
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Module Selector Screen
  if (showModuleSelector) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Select Module
            </h1>
            <p className="text-gray-600">
              Choose which module you want to complete
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => handleModuleSelect(module.id)}
                className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-6 text-left transition-all hover:shadow-lg hover:border-gray-300"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-xl ${getModuleColor(module.module_type)}`}
                >
                  {getModuleIcon(module.module_type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 capitalize">
                    {module.module_type} Test
                  </h3>
                  <p className="text-sm text-gray-600">
                    {module.heading || "Start this module"}
                  </p>
                </div>
                <ChevronRight className="h-6 w-6 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Exam Interface
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${getModuleColor(currentModule?.module_type || "")}`}
            >
              {getModuleIcon(currentModule?.module_type || "")}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 capitalize">
                {currentModule?.module_type} Test
              </h2>
              <p className="text-sm text-gray-600">
                Section {currentSectionIndex + 1} of {sections.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {answeredQuestions} / {totalQuestions}
                </p>
                <p className="text-xs text-gray-500">Answered</p>
              </div>
              <div className="h-12 w-12">
                <svg className="transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={
                      completionPercentage >= 75
                        ? "#10b981"
                        : completionPercentage >= 50
                          ? "#f59e0b"
                          : "#ef4444"
                    }
                    strokeWidth="3"
                    strokeDasharray={`${completionPercentage}, 100`}
                  />
                </svg>
              </div>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <span
                className={`text-lg font-semibold ${timeLeft < 300 ? "text-red-600" : "text-gray-900"}`}
              >
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition-colors hover:bg-green-700"
            >
              Submit Module
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Section Navigation */}
        <div className="w-64 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Sections
            </h3>
            <div className="space-y-2">
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(index)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    index === currentSectionIndex
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="block font-medium">
                    Section {section.section_index}
                  </span>
                  {section.title && (
                    <span className="block text-xs opacity-75 mt-0.5">
                      {section.title}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {flaggedQuestions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Flag className="h-4 w-4 text-orange-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Flagged ({flaggedQuestions.length})
                  </h3>
                </div>
                <p className="text-xs text-gray-600">
                  Review flagged questions before submitting
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-4xl">
            {currentSection && (
              <div className="rounded-2xl border border-gray-200 bg-white p-8">
                {/* Section Header */}
                {currentSection.title && (
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {currentSection.title}
                  </h2>
                )}

                {currentSection.instruction && (
                  <div className="mb-6 rounded-lg bg-blue-50 p-4 border border-blue-200">
                    <p className="text-sm text-blue-900">
                      {currentSection.instruction}
                    </p>
                  </div>
                )}

                {/* Content */}
                {currentSection.content_type === "text" &&
                  currentSection.content_text && (
                    <div className="prose max-w-none mb-8">
                      <div
                        dangerouslySetInnerHTML={{
                          __html: currentSection.content_text,
                        }}
                      />
                    </div>
                  )}

                {currentSection.content_type === "audio" &&
                  currentSection.resource_url && (
                    <div className="mb-8">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <audio
                          controls
                          className="w-full"
                          onError={(e) => {
                            console.error(
                              "Audio loading error:",
                              currentSection.resource_url,
                            );
                            e.currentTarget.parentElement!.innerHTML =
                              '<p class="text-red-600 text-sm">Failed to load audio. Please check the file path or contact support.</p>';
                          }}
                        >
                          <source
                            src={currentSection.resource_url}
                            type="audio/mpeg"
                          />
                          <source
                            src={currentSection.resource_url}
                            type="audio/mp3"
                          />
                          <source
                            src={currentSection.resource_url}
                            type="audio/wav"
                          />
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    </div>
                  )}

                {currentSection.content_type === "image" &&
                  currentSection.resource_url && (
                    <div className="mb-8">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <img
                          src={currentSection.resource_url}
                          alt={currentSection.title || "Section image"}
                          className="max-w-full h-auto rounded"
                          onError={(e) => {
                            console.error(
                              "Image loading error:",
                              currentSection.resource_url,
                            );
                            e.currentTarget.alt = "Failed to load image";
                            e.currentTarget.className = "hidden";
                            const errorMsg = document.createElement("p");
                            errorMsg.className = "text-red-600 text-sm";
                            errorMsg.textContent =
                              "Failed to load image. Please check the file path or contact support.";
                            e.currentTarget.parentElement!.appendChild(
                              errorMsg,
                            );
                          }}
                        />
                      </div>
                    </div>
                  )}

                {/* Questions will be rendered here - implement based on sub_sections and question_answers */}
                <div className="text-center text-gray-500 py-8">
                  <p>Questions component to be implemented</p>
                  <p className="text-sm mt-2">
                    Use sub_sections and question_answers from context
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={handlePrevSection}
                disabled={currentSectionIndex === 0}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
                Previous Section
              </button>

              <button
                onClick={handleNextSection}
                disabled={currentSectionIndex === sections.length - 1}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Section
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExamPage() {
  return (
    <ExamProvider>
      <WaitingRoom />
    </ExamProvider>
  );
}
