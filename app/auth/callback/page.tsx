import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const code = params.code;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!code) {
    redirect("/auth/login?error=no_code");
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Ignore server component cookie errors
        }
      },
    },
  });

  // Exchange code for session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Exchange code error:", error);
    redirect("/auth/login?error=exchange_failed");
  }

  if (!data.session) {
    console.error("No session after exchange");
    redirect("/auth/login?error=no_session");
  }

  const email = data.session.user.email;
  const metadata = data.session.user.user_metadata || {};
  const declaredRole = metadata.role as string | undefined;

  // Create admin profile if needed
  if (declaredRole && ["admin", "owner", "examiner"].includes(declaredRole)) {
    await supabase.from("users").upsert(
      {
        user_id: data.session.user.id,
        email: data.session.user.email,
        full_name: metadata.full_name || metadata.name || email,
        role: declaredRole,
        is_active: true,
      },
      { onConflict: "user_id" },
    );
  }

  if (!email) {
    console.error("No email in session");
    redirect("/auth/login?error=no_email");
  }

  // Check student_profiles by email
  const { data: studentProfile, error: studentError } = await supabase
    .from("student_profiles")
    .select("student_id, center_id, email")
    .eq("email", email)
    .maybeSingle();

  if (studentError) {
    console.error("Student profile query error:", studentError);
    redirect("/auth/login?error=profile_query_failed");
  }

  if (!studentProfile) {
    console.error("No student profile found for email:", email);
    redirect("/auth/login?error=not_student");
  }

  if (!studentProfile.center_id) {
    console.error("Student profile has no center_id");
    redirect("/auth/login?error=no_center");
  }

  // Get center slug
  const { data: center, error: centerError } = await supabase
    .from("centers")
    .select("slug")
    .eq("center_id", studentProfile.center_id)
    .maybeSingle();

  if (centerError) {
    console.error("Center query error:", centerError);
    redirect("/auth/login?error=center_query_failed");
  }

  if (!center || !center.slug) {
    console.error(
      "No center found or no slug for center_id:",
      studentProfile.center_id,
    );
    redirect("/auth/login?error=center_not_found");
  }

  // Success - redirect to mock test
  redirect(`/mock-test/${center.slug}`);
}
