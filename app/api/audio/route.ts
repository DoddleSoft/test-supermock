import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Proxy endpoint for exam audio files.
 * Supports HTTP 206 Partial Content for precise audio seeking.
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

    // --- NEW: Extract Range header from the client request ---
    const range = request.headers.get("range");
    const fetchHeaders: HeadersInit = {};

    // If the browser wants a specific chunk (e.g., resuming), ask Supabase for that chunk
    if (range) {
      fetchHeaders["Range"] = range;
    }

    // Fetch the audio, passing the Range header
    const upstream = await fetch(audioUrl, {
      headers: fetchHeaders,
    });

    // Accept both 200 (Full Content) and 206 (Partial Content)
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: "Failed to fetch audio" },
        { status: 502 },
      );
    }

    const responseHeaders = new Headers();

    // Safely copy essential headers
    responseHeaders.set(
      "Content-Type",
      upstream.headers.get("content-type") || "audio/mpeg",
    );
    // Explicitly tell the browser that seeking is supported!
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "private, no-store");
    responseHeaders.set("X-Content-Type-Options", "nosniff");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    // --- NEW: Forward the 206 Partial Content status and headers ---
    if (upstream.status === 206) {
      const contentRange = upstream.headers.get("content-range");
      if (contentRange) {
        responseHeaders.set("Content-Range", contentRange);
      }
      return new NextResponse(upstream.body, {
        status: 206,
        headers: responseHeaders,
      });
    }

    // Standard fallback: return 200 OK for full file requests
    return new NextResponse(upstream.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[Audio Proxy] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
