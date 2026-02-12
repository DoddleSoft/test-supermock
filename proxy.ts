import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  if (!supabaseUrl || !supabaseKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Define public routes that don't require authentication
  const publicRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/callback",
    "/auth/reset-password",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // Allow public routes without auth check
  if (isPublicRoute) {
    return response;
  }

  // If no valid user session exists, clear all auth cookies and redirect to login
  if (!user) {
    // Clear Supabase auth cookies
    const authCookies = request.cookies
      .getAll()
      .filter(
        (cookie) =>
          cookie.name.includes("supabase") ||
          cookie.name.includes("auth-token") ||
          cookie.name.includes("sb-"),
      );

    authCookies.forEach((cookie) => {
      response.cookies.delete(cookie.name);
    });

    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Root path - redirect based on authentication
  if (pathname === "/") {
    // User is authenticated, redirect to mock-test hub (will handle center redirect)
    return NextResponse.redirect(new URL("/mock-test", request.url));
  }

  // Validate center affiliation for mock-test routes
  if (user && pathname.startsWith("/mock-test/")) {
    const pathParts = pathname.split("/");
    const slugFromUrl = pathParts[2]; // /mock-test/[slug]/...

    // Skip validation for base /mock-test route (hub page handles it)
    if (!slugFromUrl) {
      return response;
    }

    try {
      // Get student profile with center
      const { data: studentProfile } = await supabase
        .from("student_profiles")
        .select("student_id, center_id, email, status")
        .eq("email", user.email!)
        .maybeSingle();

      if (!studentProfile || studentProfile.status !== "active") {
        return NextResponse.redirect(
          new URL("/?reason=no-center", request.url),
        );
      }

      // Get center slug
      const { data: center } = await supabase
        .from("centers")
        .select("center_id, slug, is_active")
        .eq("center_id", studentProfile.center_id)
        .maybeSingle();

      if (!center || !center.is_active) {
        return NextResponse.redirect(
          new URL("/?reason=no-center", request.url),
        );
      }

      // Redirect if accessing wrong center
      if (center.slug !== slugFromUrl) {
        return NextResponse.redirect(
          new URL(`/mock-test/${center.slug}`, request.url),
        );
      }
    } catch (error) {
      console.error("[Middleware] Error validating center access:", error);
      // On error, allow through (page will handle validation)
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
