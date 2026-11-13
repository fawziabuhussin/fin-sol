import { NextResponse } from "next/server";
import { InvalidReferenceError } from "@/lib/security/owned-refs";

/**
 * Maps thrown errors to API responses. `requireUser` throws "UNAUTHORIZED"
 * for genuine auth failures; references to other tenants' rows become 400;
 * everything else is a real server error and surfaces as 500 — with a generic
 * message in production so database/internal details never leak to clients.
 */
export function handleApiError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof InvalidReferenceError) {
    return NextResponse.json(
      { error: "INVALID_REFERENCE", field: error.field },
      { status: 400 }
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  console.error("[api] unhandled error:", error);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : error instanceof Error
        ? error.message
        : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
