"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/helpers/auth";
import { toast } from "sonner";

export default function Navbar() {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [centerSlug, setCenterSlug] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, userProfile, signOut, loading } = useAuth();

  // Check authentication and get center slug on mount
  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        try {
          const access = await authService.getStudentAccess();
          if (access.allowed && access.centerSlug) {
            setCenterSlug(access.centerSlug);
          }
        } catch (error) {
          console.error("Access check error:", error);
        }
      }
    };

    checkAccess();
  }, [user]);

  // Standard practice: Add background blur only after scrolling
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleStartTest = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }

    if (!centerSlug) {
      toast.error(
        "Unable to determine your test center. Please contact support.",
      );
      return;
    }

    setIsLoading(true);
    router.push(`/mock-test/${centerSlug}/exchange-code`);
  };

  const handleSmoothScroll = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    e.preventDefault(); // Prevent instant jump
    const element = document.getElementById(id);
    if (element) {
      // Offset for the fixed header height (approx 80px)
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 flex justify-center transition-all duration-300 pointer-events-none ${
        scrolled ? "py-2 md:py-4" : "py-4 md:py-6"
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
            <p className="text-sm text-gray-700 font-semibold">Test Portal</p>
          </div>

          <a
            href="#instructions"
            className="text-md font-semibold cursor-pointer bg-gradient-to-r from-red-400 to-red-700 bg-clip-text text-transparent hover:underline"
          >
            Instructions
          </a>

          {/* --- CTA & Mobile Toggle --- */}
          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex gap-4 justify-end">
              {/* CENTER: Center Name */}

              <Link
                href={`/mock-test/${centerSlug}/profile`}
                className="flex items-center gap-3 pr-2 border-r border-red-400 border-r-2 hover:bg-red-50 cursor-pointer rounded-lg transition-colors px-3 py-2 group"
              >
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 group-hover:text-red-600 transition-colors">
                    {userProfile?.full_name ||
                      user?.email?.split("@")[0] ||
                      "User"}
                  </p>
                  <p className="text-[12px] text-slate-500">
                    {user?.email || "N/A"}
                  </p>
                </div>
              </Link>
            </div>

            {/* Mobile Toggle Button */}
            <button
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 focus:outline-none hover:bg-slate-100 rounded-full transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* --- Mobile Menu --- */}
        {isMobileMenuOpen && (
          <div className="mt-2 p-3 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/20 shadow-xl md:hidden flex flex-col gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
            <Link
              href="/#features"
              onClick={(e) => handleSmoothScroll(e, "features")}
              className="text-slate-600 font-medium px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Features
            </Link>
            <Link
              href="/#pricing"
              onClick={(e) => handleSmoothScroll(e, "pricing")}
              className="text-slate-600 font-medium px-4 py-3 hover:bg-slate-50 rounded-xl transition-colors"
            >
              Pricing
            </Link>
            <div className="h-px bg-slate-100 my-1 mx-2" /> {/* Divider */}
            <button
              onClick={() => {
                handleStartTest();
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-center px-5 py-3 text-sm font-bold text-white bg-red-600 rounded-xl active:scale-95 transition-transform hover:bg-red-700"
            >
              Start Test
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
