"use client";

import { AlertTriangle, X } from "lucide-react";

export interface TimeWarningModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  remainingMinutes: number;
}

export default function TimeWarningModal({
  isOpen,
  onDismiss,
  remainingMinutes,
}: TimeWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95 duration-200">
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-yellow-600 animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">
          Time Warning
        </h3>

        {/* Message */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 text-center">
            You have{" "}
            <span className="font-bold text-yellow-900">
              {remainingMinutes} minutes
            </span>{" "}
            remaining before the test center closes.
          </p>
          <p className="text-xs text-gray-600 text-center mt-2">
            Please ensure you submit your answers before time runs out.
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={onDismiss}
          className="w-full py-3 px-6 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-xl transition-colors duration-200 active:scale-95"
        >
          I Understand, Continue
        </button>

        {/* Info */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Your answers are being auto-saved regularly
        </p>
      </div>
    </div>
  );
}
