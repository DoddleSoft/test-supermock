import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Proxy endpoint for exam audio files.
 * The client sends an opaque section/subsection ID; the server resolves
 * the real storage URL, validates authentication, and streams the bytes
 * back so the actual URL is never exposed in the browser DOM.
 */
export async function GET(request: NextRequest) {
  const sectionId = request.nextUrl.searchParams.get("sectionId");
  const subSectionId = request.nextUrl.searchParams.get("subSectionId");

  if (!sectionId && !subSectionId) {
    return NextResponse.json(
      { error: "Missing sectionId or subSectionId" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Verify the user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let audioUrl: string | null = null;

    // Resolve the actual audio URL from the database
    if (sectionId) {
      const { data } = await supabase
        .from("sections")
        .select("resource_url")
        .eq("id", sectionId)
        .single();
      if (data?.resource_url) audioUrl = data.resource_url;
    }

    if (!audioUrl && subSectionId) {
      const { data } = await supabase
        .from("sub_sections")
        .select("resource_url")
        .eq("id", subSectionId)
        .single();
      if (data?.resource_url) audioUrl = data.resource_url;
    }

    if (!audioUrl) {
      return NextResponse.json({ error: "Audio not found" }, { status: 404 });
    }

    // Fetch the actual audio and stream it through
    const upstream = await fetch(audioUrl);

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Failed to fetch audio" },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstream.headers.get("content-length");

    const headers: HeadersInit = {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    };

    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (error) {
    console.error("[Audio Proxy] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
