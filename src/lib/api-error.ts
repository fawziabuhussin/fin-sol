import { NextResponse } from "next/server";

/**
 * Maps thrown errors to API responses. `requireUser` throws "UNAUTHORIZED"
 * for genuine auth failures; everything else is a real server error and
 * should surface as 500 (not be masked as 401).
 */
export function handleApiError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const message =
    error instanceof Error ? error.message : "Internal server error";
  console.error("[api] unhandled error:", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
