"use client";

import React from "react";

export type ThemeColor = "green" | "blue" | "purple";

export interface RenderBlockProps {
  block: {
    type: string;
    content?: string;
    alt?: string;
    label?: string;
    placeholder?: string;
    min_words?: number;
  };
  theme?: ThemeColor;
  // Optional interactive props (for Reading/Listening)
  questions?: Record<string, { answer: string; options?: any[] }>;
  answers?: Record<string, string>;
  onAnswerChange?: (qNum: string, value: string) => void;
}

// Theme color mappings
const themeColors = {
  green: {
    instruction: "bg-blue-50 text-blue-900",
    box: "border-gray-200 bg-gray-50",
    boxBorder: "",
    focus: "focus:border-green-600 focus:ring-green-600",
    radio: "text-green-600 focus:ring-green-500",
  },
  blue: {
    instruction: "bg-blue-50 text-blue-900",
    box: "border-gray-200 bg-gray-50",
    boxBorder: "",
    focus: "focus:border-blue-600 focus:ring-blue-600",
    radio: "text-blue-600 focus:ring-blue-500",
  },
  purple: {
    instruction: "bg-purple-50 text-purple-900",
    box: "bg-gray-50",
    boxBorder: "border-l-4 border-purple-600",
    focus: "focus:border-purple-600 focus:ring-purple-600",
    radio: "text-purple-600 focus:ring-purple-500",
  },
};

export const RenderBlock: React.FC<RenderBlockProps> = ({
  block,
  theme = "green",
  questions = {},
  answers = {},
  onAnswerChange,
}) => {
  const { type, content } = block;
  const colors = themeColors[theme];

  // Parse placeholders like {{1}boolean}, {{8}blanks}, {{14}dropdown}
  const renderContent = (text: string) => {
    if (!onAnswerChange) {
      return <>{text}</>;
    }

    const regex = /{{(\d+)}(boolean|blanks|dropdown)}/g;
    const parts: React.ReactElement[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.index)}
          </span>,
        );
      }

      const qNum = match[1];
      const inputType = match[2];
      const qData = questions[qNum];

      if (inputType === "boolean" && qData?.options) {
        // Render dropdown for TRUE/FALSE/NOT GIVEN
        parts.push(
          <select
            key={`q-${qNum}`}
            value={answers[qNum] || ""}
            onChange={(e) => onAnswerChange(qNum, e.target.value)}
            className={`mx-1 inline-block min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-1 ${colors.focus}`}
          >
            <option value="">Select...</option>
            {qData.options.map((opt: any) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>,
        );
      } else if (inputType === "dropdown" && qData?.options) {
        // Render dropdown for MCQ options (i, ii, iii, A, B, C, etc.)
        parts.push(
          <select
            key={`q-${qNum}`}
            value={answers[qNum] || ""}
            onChange={(e) => onAnswerChange(qNum, e.target.value)}
            className={`mx-1 inline-block min-w-[100px] rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-1 ${colors.focus}`}
          >
            <option value="">Select...</option>
            {qData.options.map((opt: any) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>,
        );
      } else if (inputType === "blanks") {
        // Render text input for fill-in-the-blank with question number
        parts.push(
          <span key={`q-${qNum}`} className="inline-flex items-center gap-1">
            <span className="text-xs font-semibold text-gray-600">{qNum}.</span>
            <input
              type="text"
              value={answers[qNum] || ""}
              onChange={(e) => onAnswerChange(qNum, e.target.value)}
              placeholder="___"
              className={`inline-block w-32 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-1 ${colors.focus}`}
            />
          </span>,
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text after the last match
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>,
      );
    }

    return parts.length > 0 ? parts : <>{text}</>;
  };

  switch (type) {
    case "header":
      return (
        <h3 className="mt-4 mb-3 text-base font-bold text-gray-900">
          {content}
        </h3>
      );

    case "instruction":
      return (
        <p
          className={`mb-4 rounded-lg p-3 text-xs italic ${colors.instruction}`}
        >
          {content}
        </p>
      );

    case "title":
      return (
        <h4 className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-gray-800">
          {content}
        </h4>
      );

    case "subtitle":
      return (
        <h5 className="mt-3 mb-2 text-xs font-semibold text-gray-700">
          {content}
        </h5>
      );

    case "box":
      // Purple theme uses border-left style, others use full border
      if (theme === "purple") {
        return (
          <div
            className={`my-4 rounded-lg p-4 ${colors.boxBorder} ${colors.box}`}
          >
            <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 font-medium">
              {content}
            </pre>
          </div>
        );
      }
      return (
        <div className={`my-4 rounded-lg border p-4 ${colors.box}`}>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
            {content}
          </pre>
        </div>
      );

    case "text":
      // Check for Radio/MCQ Block Type first (used in Listening)
      if (content && onAnswerChange) {
        const mcqMatch = content.match(/{{(\d+)}mcq}/);

        if (mcqMatch) {
          const qNum = mcqMatch[1];
          const qData = questions[qNum];
          // Clean the text to remove the tag
          const cleanContent = content.replace(/{{(\d+)}mcq}/, "").trim();

          return (
            <div className="mb-4 text-xs leading-7 text-gray-800">
              {/* The Question Text */}
              <div className="mb-2">
                <span className="font-semibold text-gray-600 mr-1">
                  {qNum}.
                </span>
                {cleanContent}
              </div>

              {/* The Options (Radio Buttons) */}
              <div className="ml-4 space-y-2">
                {qData?.options?.map((opt: any) => {
                  const label = typeof opt === "string" ? opt : opt.label;
                  const text = typeof opt === "string" ? "" : opt.text;
                  return (
                    <label
                      key={label}
                      className="flex cursor-pointer items-start gap-2"
                    >
                      <input
                        type="radio"
                        name={`q-${qNum}`}
                        value={label}
                        checked={answers[qNum] === label}
                        onChange={(e) => onAnswerChange(qNum, e.target.value)}
                        className={`mt-0.5 h-3 w-3 border-gray-300 ${colors.radio}`}
                      />
                      <span className="text-xs text-gray-700">
                        <span className="font-bold mr-1">{label}</span>
                        {text}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        }

        // Default: Inline Rendering (Dropdowns / Blanks) for Reading/Listening
        return (
          <div className="mb-2 text-xs leading-7 text-gray-800">
            {renderContent(content)}
          </div>
        );
      }

      // Simple text rendering for Writing (no interactive elements)
      return (
        <p className="mb-2 text-sm leading-relaxed text-gray-700">{content}</p>
      );

    case "image":
      // Writing uses max-h-74, Reading/Listening use max-h-96
      const maxHeight = theme === "purple" ? "max-h-74" : "max-h-96";
      return (
        <div className="my-6 flex justify-center">
          <img
            src={content}
            alt={block.alt || "Task image"}
            className={`${maxHeight} w-auto rounded-lg border shadow-sm object-contain`}
          />
        </div>
      );

    case "editor":
      // This is handled separately in the answer section (Writing only)
      return null;

    default:
      return null;
  }
};

export default RenderBlock;
