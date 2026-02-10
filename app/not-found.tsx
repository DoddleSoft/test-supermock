"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function NotFound() {
  const pathname = usePathname();

  // ⚠ Safe default first (important for build)
  const [mockTestHref, setMockTestHref] = useState("/mock-test");

  // Don't read auth during build render
  const auth = useAuth?.();
  const studentCenterSlug = auth?.studentCenterSlug;

  const slugFromPath = useMemo(() => {
    if (!pathname) return null;
    const parts = pathname.split("/").filter(Boolean);
    const mockTestIndex = parts.indexOf("mock-test");
    if (mockTestIndex >= 0 && parts[mockTestIndex + 1]) {
      return parts[mockTestIndex + 1];
    }
    return null;
  }, [pathname]);

  useEffect(() => {
    // Only runs in browser → safe
    if (slugFromPath) {
      setMockTestHref(`/mock-test/${slugFromPath}`);
      return;
    }

    if (studentCenterSlug) {
      setMockTestHref(`/mock-test/${studentCenterSlug}`);
      return;
    }

    if (typeof window !== "undefined") {
      const centerSlug = sessionStorage.getItem("centerSlug");
      if (centerSlug) {
        setMockTestHref(`/mock-test/${centerSlug}`);
      }
    }
  }, [slugFromPath, studentCenterSlug]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <span className="text-5xl font-medium tracking-[0.2em] text-gray-400 uppercase">
          Error 404
        </span>

        <p className="mx-auto mt-6 max-w-lg text-md leading-relaxed text-gray-500">
          The page you are looking for has been moved or never existed.
        </p>

        <div className="mt-12">
          <Link
            href={mockTestHref}
            className="inline-flex items-center gap-2 rounded-full border border-gray-900 bg-gray-900 px-8 py-3 text-white hover:bg-transparent hover:text-gray-900"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
