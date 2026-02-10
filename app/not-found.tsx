"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/component/ui/loader";
import { authService } from "@/helpers/auth";

/**
 * 404 Not Found Handler
 * Redirects users to appropriate page based on authentication status
 */
export default function NotFound() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(true);

  useEffect(() => {
    const handleNotFound = async () => {
      try {
        // Check if user is authenticated
        const access = await authService.getStudentAccess();

        if (!access.success || !access.allowed) {
          // Not authenticated, redirect to login
          router.push("/auth/login");
          return;
        }

        // User is authenticated, redirect to their center
        if (access.centerSlug) {
          router.push(`/mock-test/${access.centerSlug}`);
        } else {
          // No center assigned
          router.push("/mock-test");
        }
      } catch (error) {
        console.error("[NotFound] Error:", error);
        // Fallback to login on error
        router.push("/auth/login");
      } finally {
        setIsRedirecting(false);
      }
    };

    handleNotFound();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <Loader />
    </div>
  );
}
