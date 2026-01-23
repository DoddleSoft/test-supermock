import { Check } from "lucide-react";

export function BrandedSection() {
  return (
    <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-red-500 to-red-600 flex-col justify-center items-center p-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-800 rounded-full opacity-10 -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-900 rounded-full opacity-10 -ml-48 -mb-48"></div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-md">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center gap-2 mb-4">
            <div className="text-5xl font-bold text-white mb-4">SuperMock</div>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-white text-start mb-4">
          Prepare with Confidence for Your IELTS Mock Test
        </h2>
        <p className="text-white/80 mb-8 text-md text-start leading-relaxed">
          Experience real IELTS-style mock tests designed to help you improve
          your score. Practice each module, understand your mistakes, and walk
          into the exam fully prepared.
        </p>

        {/* Features */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center text-white gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Check className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm"> Real Exam Pattern & Timed Tests</span>
          </div>
          <div className="flex items-center text-white gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Check className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm">
              Practice Reading, Writing, Listening Modules
            </span>
          </div>
          <div className="flex items-center text-white gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Check className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm">
              Track Progress & Improve Your Band Scores
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
