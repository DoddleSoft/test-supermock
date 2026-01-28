"use client";

interface OverallScoreCardProps {
  overallScore: number;
  testDate: string;
  testName: string;
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
}

export default function OverallScoreCard({
  overallScore,
  testDate,
  testName,
  listening,
  reading,
  writing,
  speaking,
}: OverallScoreCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-sm">
      {/* Overall Score Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-light text-gray-400 mb-4">
          Overall score
        </h2>
        <div className="text-6xl font-bold text-red-500 mb-4">
          {overallScore.toFixed(1)}
        </div>
        <p className="text-gray-600 text-xs font-semibold">
          {testDate} — {testName}
        </p>
      </div>

      {/* Individual Scores Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Listening */}
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Listening
          </p>
          <div className="text-4xl font-bold text-red-500">
            {listening.toFixed(1)}
          </div>
        </div>

        {/* Reading */}
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Reading
          </p>
          <div className="text-4xl font-bold text-red-500">
            {reading.toFixed(1)}
          </div>
        </div>

        {/* Writing */}
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Writing
          </p>
          <div className="text-4xl font-bold text-red-500">
            {writing.toFixed(1)}
          </div>
        </div>

        {/* Speaking */}
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Speaking
          </p>
          <div className="text-4xl font-bold text-red-500">N/A</div>
        </div>
      </div>
    </div>
  );
}
