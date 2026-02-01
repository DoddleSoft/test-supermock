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
} from "lucide-react";

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

export default function WaitingRoomClient({
  attemptId,
  centerSlug,
  modules,
}: WaitingRoomClientProps) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Slight delay for smooth transition
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

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
    // Navigate to module-specific route
    router.push(`/mock-test/${centerSlug}/${attemptId}/${moduleType}`);
  };

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
            <p className="text-gray-600 mb-6">Loading test modules...</p>
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
