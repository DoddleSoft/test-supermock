"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/helpers/auth";
import { Loader } from "@/component/ui/loader";
import { toast } from "sonner";

/**
 * Mock Test Hub - Redirects authenticated users to their center
 * This acts as an intermediary that gets the user's center and redirects them
 */
export default function MockTestHub() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const redirectToCenter = async () => {
      try {
        // Get student's center affiliation
        const access = await authService.getStudentAccess();

        if (!access.success) {
          toast.error(access.error || "Failed to verify access");
          router.push("/auth/login");
          return;
        }

        if (!access.allowed) {
          toast.error("You don't have access to mock tests");
          router.push(access.redirectPath || "/auth/login");
          return;
        }

        if (!access.centerSlug) {
          router.push("/?reason=no-center");
          return;
        }

        // Redirect to user's center
        router.replace(`/mock-test/${access.centerSlug}`);
      } catch (error) {
        console.error("[MockTestHub] Error:", error);
        toast.error("Failed to load your center");
        router.push("/auth/login");
      } finally {
        setIsLoading(false);
      }
    };

    redirectToCenter();
  }, [router]);

  if (isLoading) {
    return <Loader fullScreen />;
  }

  return <Loader fullScreen />;
}
