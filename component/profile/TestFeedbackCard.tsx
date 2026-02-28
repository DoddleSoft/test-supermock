"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

interface ModuleEntry {
  module_type: string;
  band_score: number;
  score_obtained: number;
  time_spent_seconds: number;
  module_duration_minutes: number;
  feedback: string | null;
}

interface TestFeedbackCardProps {
  testTitle: string;
  completedAt: string;
  testOverall: number;
  moduleEntries: ModuleEntry[];
}

export default function TestFeedbackCard({
  testTitle,
  completedAt,
  testOverall,
  moduleEntries,
}: TestFeedbackCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper functions
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getModuleColor = (moduleType: string) => {
    switch (moduleType) {
      case "listening":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "reading":
        return "bg-green-100 text-green-700 border-green-200";
      case "writing":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "speaking":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getModuleName = (moduleType: string) => {
    return moduleType.charAt(0).toUpperCase() + moduleType.slice(1);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Test Header */}
      <div className="bg-gradient-to-r from-red-50 to-red-100 px-6 py-4 border-b border-red-200">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{testTitle}</h3>
            <p className="text-sm text-gray-600 mt-1">
              Completed on {completedAt}
            </p>
          </div>

          {/* Overall Score Card */}
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white rounded-lg shadow-sm border border-red-200 px-5 gap-4 py-3">
              <p className="text-sm text-gray-500 uppercase tracking-wide text-center">
                Overall Band
              </p>
              <p className="text-2xl font-bold text-red-500 text-center">
                {testOverall.toFixed(1)}
              </p>
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-red-100 rounded-full transition-colors"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <ChevronDown
                className={`h-6 w-6 text-red-500 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Modules Grid - Collapsible */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {moduleEntries.map((module, idx) => (
            <div
              key={idx}
              className="border border-gray-200 rounded-lg px-5 py-4 hover:shadow-md transition-shadow"
            >
              {/* Module Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-xl text-sm font-semibold border ${getModuleColor(module.module_type)}`}
                  >
                    {getModuleName(module.module_type)}
                  </span>
                  <div className="text-3xl font-bold text-gray-900">
                    {module.band_score.toFixed(1)}
                    <span className="text-lg text-gray-500 font-normal ml-1">
                      / 9.0
                    </span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Band Score
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {module.band_score.toFixed(1)}
                    </p>
                  </div>
                  {module.time_spent_seconds > 0 && (
                    <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">
                        Time Taken
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatTime(module.time_spent_seconds)}
                      </p>
                      {module.module_duration_minutes > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          of {module.module_duration_minutes} min
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Score
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {module.score_obtained.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Feedback */}
              {module.feedback && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <Info className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-red-900 uppercase tracking-wide mb-1">
                        Feedback
                      </p>
                      <p className="text-md text-gray-700 leading-relaxed whitespace-pre-line pt-1">
                        {module.feedback}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
