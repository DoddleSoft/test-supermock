"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { Menu, X, LogOut, User } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface NavbarProps {
  hideInstructions?: boolean;
  disableProfileLink?: boolean;
}

export default function Navbar({
  hideInstructions = false,
  disableProfileLink = false,
}: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, userProfile, studentName, studentCenterSlug, signOut } =
    useAuth();

  const menuRef = useRef<HTMLDivElement>(null);

  // Center info for whitelabeling
  const [centerSlug, setCenterSlug] = useState<string | null>(null);
  const [centerInfo, setCenterInfo] = useState<{
    name: string;
    logo_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (studentCenterSlug) {
      setCenterSlug(studentCenterSlug);
    }
  }, [studentCenterSlug]);

  // Fetch center info only if slug changes and not already loaded
  useEffect(() => {
    if (!centerSlug) {
      setCenterInfo(null);
      return;
    }
    let ignore = false;
    const fetchCenter = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("centers")
        .select("name,logo_url")
        .eq("slug", centerSlug)
        .eq("is_active", true)
        .single();
      if (!ignore) {
        setCenterInfo(
          data ? { name: data.name, logo_url: data.logo_url } : null,
        );
      }
    };
    fetchCenter();
    return () => {
      ignore = true;
    };
  }, [centerSlug]);

  // Standard practice: Add background blur only after scrolling
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout. Please try again.");
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
            ${"px-4 py-1 md:px-6 md:py-2 lg:px-8"}
            ${
              scrolled
                ? "bg-white/70 backdrop-blur-xl border-white/20 shadow-md"
                : "bg-white/50 border-transparent shadow-sm"
            }`}
        >
          {/* --- Brand (Whitelabel) --- */}
          <div className="flex items-center gap-3">
            {centerInfo ? (
              <>
                {centerInfo.logo_url ? (
                  <Image
                    src={centerInfo.logo_url}
                    alt={centerInfo.name + " logo"}
                    width={120}
                    height={120}
                    className="rounded object-contain"
                  />
                ) : (
                  <Image
                    src="/supermock-logo.png"
                    alt="SuperMock Logo"
                    width={120}
                    height={120}
                  />
                )}
                <span className="text-lg md:text-xl tracking-tight text-slate-900">
                  <div className="font-bold">{centerInfo.name}</div>
                  <p className="text-xs text-gray-700">Test Portal</p>
                </span>
              </>
            ) : (
              <>
                <Image
                  src="/supermock-logo.png"
                  alt="SuperMock Logo"
                  width={60}
                  height={60}
                />
                <button
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                  className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 hover:opacity-80 transition-opacity"
                >
                  Super<span className="text-red-600">Mock</span>
                </button>
              </>
            )}
          </div>

          {!hideInstructions && (
            <a
              href="#instructions"
              className="text-md font-semibold cursor-pointer bg-gradient-to-r from-red-400 to-red-700 bg-clip-text text-transparent hover:underline"
            >
              Instructions
            </a>
          )}

          {/* --- Hamburger Menu --- */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 transition-all duration-200 ${
                isMenuOpen
                  ? "bg-red-50 border-red-300 text-red-700"
                  : "bg-white/60 border-gray-200 text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              }`}
              aria-label="Toggle menu"
            >
              {/* User initials avatar */}
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-700 text-xs font-bold shrink-0">
                {(studentName || userProfile?.name || user?.email || "U")
                  .charAt(0)
                  .toUpperCase()}
              </span>
              {/* Name – hidden on very small screens */}
              <span className="hidden sm:block text-sm font-semibold max-w-[120px] truncate">
                {studentName ||
                  userProfile?.name ||
                  user?.email?.split("@")[0] ||
                  "User"}
              </span>
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Dropdown */}
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 p-2 w-60 rounded-lg border border-gray-100 bg-white shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User info header */}
                <div className="px-4 py-3 border-b rounded-md border-gray-100 bg-gray-50">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {studentName ||
                      userProfile?.name ||
                      user?.email?.split("@")[0] ||
                      "User"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user?.email || ""}
                  </p>
                </div>

                {/* Profile link */}
                {!disableProfileLink && centerSlug ? (
                  <Link
                    href={`/mock-test/${centerSlug}/profile`}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors"
                  >
                    <User size={16} className="shrink-0" />
                    <span className="font-medium">Profile</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 text-sm text-slate-400 cursor-not-allowed rounded-md">
                    <User size={16} className="shrink-0" />
                    <span className="font-medium">Profile</span>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Logout */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 rounded-md text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} className="shrink-0" />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
