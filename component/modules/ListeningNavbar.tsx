"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Image from "next/image";

interface ListeningNavbarProps {
  timeLeft?: number;
  questions?: string;
  onSubmit?: () => void;
}

export default function ListeningNavbar({
  timeLeft = 0,
  questions,
  onSubmit,
}: ListeningNavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Standard practice: Add background blur only after scrolling
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-300 pointer-events-none ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div className="w-[95%] md:w-full md:max-w-5xl lg:max-w-7xl rounded-2xl pointer-events-auto">
        <div
          className={`relative flex items-center justify-between rounded-2xl border transition-all duration-300 
            ${"px-4 py-3 md:px-6 md:py-4 lg:px-8"}
            ${
              scrolled
                ? "bg-white/70 backdrop-blur-xl border-white/20 shadow-md"
                : "bg-white/50 border-transparent shadow-sm"
            }`}
        >
          {/* --- Brand --- */}
          <div className="flex items-center gap-3">
            <Image
              src="/supermock-logo.png"
              alt="SuperMock Logo"
              width={40}
              height={40}
            />
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 hover:opacity-80 transition-opacity"
            >
              Super<span className="text-red-600">Mock</span>
            </button>
            <div className="h-8 bg-slate-300 w-[2px]"></div>
            <p className="text-sm text-gray-700 font-semibold">Listening</p>
          </div>

          {/* --- Questions Display --- */}
          {questions && (
            <div className="hidden md:flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-50 border border-blue-200">
              <span className="text-sm font-semibold text-gray-900">
                Questions {questions}
              </span>
            </div>
          )}

          {/* --- CTA & Mobile Toggle --- */}
          <div className="flex items-center gap-6">
            <p className="font-semibold text-2xl text-gray-900">
              {formatTime(timeLeft)}
            </p>

            <button
              onClick={onSubmit}
              className="hidden sm:block px-4 py-2 md:px-5 text-xs md:text-sm font-semibold text-white transition-all bg-gradient-to-r from-red-600 to-red-900 rounded-xl hover:from-red-700 hover:to-red-800 hover:shadow-sm hover:shadow-red-500/30 active:scale-95"
            >
              Submit Test
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
