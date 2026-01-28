"use client";

import { User, BarChart3, BookOpen } from "lucide-react";
import Navbar from "@/component/landing/Navbar";
import OverallScoreCard from "@/component/profile/OverallScoreCard";

export default function ProfilePage() {
  // Dummy data for the chart
  const chartData = [
    { label: "T1", score: 6, highlight: false },
    { label: "T2", score: 8, highlight: true },
    { label: "T3", score: 6.5, highlight: false },
    { label: "T4", score: 5.5, highlight: false },
    { label: "T5", score: 6, highlight: false },
    { label: "T6", score: 7, highlight: true },
    { label: "T7", score: 7.5, highlight: true },
    { label: "T8", score: 5, highlight: false },
    { label: "T9", score: 6.5, highlight: false },
    { label: "T10", score: 8.5, highlight: true },
  ];

  const maxScore = 9;

  return (
    <div className="min-h-screen bg-gray-50 pt-10">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4 md:px-8">
        {/* Main Content Area */}
        <div className="lg:col-span-9 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Overall Score Card Section */}
            <div className="lg:col-span-5">
              <OverallScoreCard
                overallScore={7.5}
                testDate="01-SEP-23"
                testName="IELTS ONLINE ACADEMIC"
                listening={8.0}
                reading={7.0}
                writing={8.0}
                speaking={6.0}
              />
            </div>

            {/* Chart Section */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <h2 className="text-lg font-semibold text-gray-800 mb-8">
                  Scores for the last 10 tests
                </h2>

                {/* Chart */}
                <div className="relative">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-400 pr-4">
                    <span>9</span>
                    <span>6</span>
                    <span>3</span>
                    <span>0</span>
                  </div>

                  {/* Chart bars */}
                  <div className="ml-8 flex items-end justify-between gap-1 h-64 border-b border-gray-200">
                    {chartData.map((item, index) => {
                      const heightPercentage = (item.score / maxScore) * 100;
                      return (
                        <div
                          key={index}
                          className="flex-1 flex flex-col items-center justify-end"
                        >
                          {/* Bar */}
                          <div
                            className={`w-full rounded-t transition-all ${
                              item.highlight ? "bg-red-500" : "bg-red-200"
                            }`}
                            style={{ height: `${heightPercentage}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* X-axis labels */}
                  <div className="ml-8 flex justify-between mt-2">
                    {chartData.map((item, index) => (
                      <div
                        key={index}
                        className="flex-1 text-center text-xs text-gray-400"
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Red dot indicator */}
                <div className="flex items-center justify-end gap-2 mt-4">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
