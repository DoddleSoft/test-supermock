"use client";

interface LoaderProps {
  subtitle?: string;
  fullScreen?: boolean;
}

export function Loader({ subtitle = "", fullScreen = true }: LoaderProps) {
  const containerClass = fullScreen
    ? "fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-red-50 flex items-center justify-center p-4"
    : "flex items-center justify-center p-4";

  return (
    <div className={containerClass}>
      <div className="text-center">
        {/* Animated Loader SVG */}
        <svg
          className="loader mx-auto mb-6 text-red-600"
          width="240"
          height="240"
          viewBox="0 0 240 240"
        >
          <circle
            className="loader-ring loader-ring-a text-red-400"
            cx="120"
            cy="120"
            r="105"
            fill="none"
            stroke="#dc2626"
            strokeWidth="20"
            strokeDasharray="0 660"
            strokeDashoffset="-330"
            strokeLinecap="round"
          ></circle>
          <circle
            className="loader-ring loader-ring-b text-red-800"
            cx="120"
            cy="120"
            r="35"
            fill="none"
            stroke="#900a0a"
            strokeWidth="20"
            strokeDasharray="0 220"
            strokeDashoffset="-110"
            strokeLinecap="round"
          ></circle>
          <circle
            className="loader-ring loader-ring-c text-red-800"
            cx="85"
            cy="120"
            r="70"
            fill="none"
            stroke="#900a0a"
            strokeWidth="20"
            strokeDasharray="0 440"
            strokeLinecap="round"
          ></circle>
          <circle
            className="loader-ring loader-ring-d text-red-400"
            cx="155"
            cy="120"
            r="70"
            fill="none"
            stroke="#dc2626"
            strokeWidth="20"
            strokeDasharray="0 440"
            strokeLinecap="round"
          ></circle>
        </svg>

        <p className="text-red-600 text-lg">{subtitle}</p>
      </div>
    </div>
  );
}
