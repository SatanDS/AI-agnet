import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function isUnauthorized(error: unknown) {
  return error instanceof Error && error.message === "Unauthorized";
}
