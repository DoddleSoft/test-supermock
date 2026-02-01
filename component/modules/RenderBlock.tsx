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
  showQuestionNumbers?: boolean;
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
  showQuestionNumbers = false,
  questions = {},
  answers = {},
  onAnswerChange,
}) => {
  const { type, content } = block;
  const colors = themeColors[theme];

  // Parse placeholders like {{1}boolean}, {{8}blanks}, {{14}dropdown}, {{3}true-false}, {{23}mcq}
  const renderContent = (text: string) => {
    if (!onAnswerChange) {
      return <>{text}</>;
    }

    const regex = /{{(\d+)}(boolean|blanks|dropdown|true-false|mcq)}/g;

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

      if (inputType === "true-false") {
        const options = qData?.options ?? ["TRUE", "FALSE", "NOT GIVEN"];
        parts.push(
          <span key={`q-${qNum}`} className="inline-flex items-center gap-1">
            {showQuestionNumbers && (
              <span className="text-xs font-semibold text-gray-600">
                {qNum}.
              </span>
            )}
            <select
              value={answers[qNum] || ""}
              onChange={(e) => onAnswerChange(qNum, e.target.value)}
              className={`mx-1 inline-block min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-1 ${colors.focus}`}
            >
              <option value="">Select...</option>
              {options.map((opt: any) => {
                const value = typeof opt === "string" ? opt : opt.label;
                const label =
                  typeof opt === "string"
                    ? opt
                    : `${opt.label}${opt.text ? ` ${opt.text}` : ""}`;
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          </span>,
        );
      } else if (inputType === "boolean" && qData?.options) {
        // Render dropdown for TRUE/FALSE/NOT GIVEN or YES/NO/NOT GIVEN
        parts.push(
          <span key={`q-${qNum}`} className="inline-flex items-center gap-1">
            {showQuestionNumbers && (
              <span className="text-xs font-semibold text-gray-600">
                {qNum}.
              </span>
            )}
            <select
              value={answers[qNum] || ""}
              onChange={(e) => onAnswerChange(qNum, e.target.value)}
              className={`mx-1 inline-block min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-1 ${colors.focus}`}
            >
              <option value="">Select...</option>
              {qData.options.map((opt: any) => {
                const value = typeof opt === "string" ? opt : opt.label;
                const label =
                  typeof opt === "string"
                    ? opt
                    : `${opt.label}${opt.text ? ` ${opt.text}` : ""}`;
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          </span>,
        );
      } else if (inputType === "mcq") {
        // Check if options are single characters (A, B, C) or longer text
        const hasOptions = qData?.options && qData.options.length > 0;

        if (hasOptions) {
          const firstOption = qData!.options![0];
          const firstLabel =
            typeof firstOption === "string" ? firstOption : firstOption.label;
          const isSingleChar = firstLabel.trim().length <= 2; // A, B, C, etc.

          if (isSingleChar) {
            // Render as dropdown for single-character options
            parts.push(
              <span
                key={`q-${qNum}`}
                className="inline-flex items-center gap-1"
              >
                {showQuestionNumbers && (
                  <span className="text-xs font-semibold text-gray-600">
                    {qNum}.
                  </span>
                )}
                <select
                  value={answers[qNum] || ""}
                  onChange={(e) => onAnswerChange(qNum, e.target.value)}
                  className={`mx-1 inline-block min-w-[140px] rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-1 ${colors.focus}`}
                >
                  <option value="">Select...</option>
                  {qData!.options!.map((opt: any) => {
                    const value = typeof opt === "string" ? opt : opt.label;
                    const label =
                      typeof opt === "string"
                        ? opt
                        : `${opt.label}${opt.text ? ` ${opt.text}` : ""}`;
                    return (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </span>,
            );
          } else {
            // Render as radio buttons for multi-word options
            parts.push(
              <div key={`q-${qNum}`} className="my-4 pl-0">
                <div className="space-y-2">
                  {qData!.options!.map((opt: any) => {
                    const value = typeof opt === "string" ? opt : opt.label;
                    const displayText =
                      typeof opt === "string"
                        ? opt
                        : `${opt.label}${opt.text ? `. ${opt.text}` : ""}`;

                    return (
                      <label
                        key={value}
                        className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                      >
                        <input
                          type="radio"
                          name={`mcq-${qNum}`}
                          value={value}
                          checked={answers[qNum] === value}
                          onChange={(e) => onAnswerChange(qNum, e.target.value)}
                          className={`mt-0.5 h-4 w-4 ${colors.radio} focus:ring-2`}
                        />
                        <span className="text-sm text-gray-800 leading-relaxed">
                          {displayText}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>,
            );
          }
        } else {
          // No options available - show placeholder
          parts.push(
            <span key={`q-${qNum}`} className="inline-flex items-center gap-1">
              {showQuestionNumbers && (
                <span className="text-xs font-semibold text-gray-600">
                  {qNum}.
                </span>
              )}
              <select
                disabled
                className="mx-1 inline-block min-w-[140px] rounded border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500"
              >
                <option>No options available</option>
              </select>
            </span>,
          );
        }
      } else if (inputType === "dropdown" && qData?.options) {
        // Render dropdown for MCQ options (i, ii, iii, A, B, C, etc.)
        parts.push(
          <span key={`q-${qNum}`} className="inline-flex items-center gap-1">
            {showQuestionNumbers && (
              <span className="text-xs font-semibold text-gray-600">
                {qNum}.
              </span>
            )}
            <select
              value={answers[qNum] || ""}
              onChange={(e) => onAnswerChange(qNum, e.target.value)}
              className={`mx-1 inline-block min-w-[100px] rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm focus:outline-none focus:ring-1 ${colors.focus}`}
            >
              <option value="">Select...</option>
              {qData.options.map((opt: any) => {
                const value = typeof opt === "string" ? opt : opt.label;
                const label =
                  typeof opt === "string"
                    ? opt
                    : `${opt.label}${opt.text ? ` ${opt.text}` : ""}`;
                return (
                  <option key={value} value={value}>
                    {label}
                  </option>
                );
              })}
            </select>
          </span>,
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
          className={`mb-4 rounded-lg p-3 text-xs italic whitespace-pre-wrap ${colors.instruction}`}
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
      // Default: Inline Rendering (Dropdowns / Blanks) for Reading/Listening
      if (content && onAnswerChange) {
        return (
          <div
            className="mb-2 text-xs leading-7 text-gray-800 whitespace-pre-wrap"
            style={{ tabSize: 4 }}
          >
            {renderContent(content)}
          </div>
        );
      }

      // Simple text rendering for Writing (no interactive elements)
      return (
        <p className="mb-2 text-sm leading-relaxed text-gray-700">{content}</p>
      );

    case "html":
      return (
        <div
          className="mb-3 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap"
          style={{ tabSize: 4 }}
          dangerouslySetInnerHTML={{ __html: content || "" }}
        />
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
