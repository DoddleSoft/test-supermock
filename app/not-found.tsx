"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 text-center">
      {/* Subtle background element */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-gradient-to-br from-gray-100/50 to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10"
      >
        <span className="text-5xl font-medium tracking-[0.2em] text-gray-400 uppercase">
          Error 404
        </span>

        <p className="mx-auto mt-6 max-w-lg text-md leading-relaxed text-gray-500">
          The page you are looking for has been moved to the void or never
          existed in the first place.
        </p>

        <div className="mt-12">
          <Link
            href="/dashboard"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-gray-900 bg-gray-900 px-8 py-3 text-white transition-all hover:bg-transparent hover:text-gray-900"
          >
            <motion.span
              className="flex items-center gap-2"
              whileHover={{ x: -4 }}
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium">Back to Home</span>
            </motion.span>
          </Link>
        </div>
      </motion.div>

      {/* Minimal Footer Decoration */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
        <div className="h-[1px] w-12 bg-gray-200" />
      </div>
    </div>
  );
}
