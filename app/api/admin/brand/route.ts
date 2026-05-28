import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { deleteBrandLogo, getBrandSettings, saveBrandLogo } from "@/lib/brand";

export async function GET() {
  try {
    await requireOwner();
    return NextResponse.json({ brand: await getBrandSettings() });
  } catch (error) {
    if (isUnauthorized(error)) {
      return jsonError("Unauthorized", 401);
    }
    if (isForbidden(error)) {
      return jsonError("Forbidden", 403);
    }
    throw error;
  }
}

export async function PUT(request: Request) {
  try {
    await requireOwner();
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("logo");

    if (!(file instanceof File) || file.size === 0) {
      return jsonError("Logo file is required.", 400);
    }

    const brand = await saveBrandLogo(file);
    return NextResponse.json({ brand });
  } catch (error) {
    if (isUnauthorized(error)) {
      return jsonError("Unauthorized", 401);
    }
    if (isForbidden(error)) {
      return jsonError("Forbidden", 403);
    }
    if (error instanceof Error) {
      return jsonError(error.message, 400);
    }
    throw error;
  }
}

export async function DELETE() {
  try {
    await requireOwner();
    await deleteBrandLogo();
    return NextResponse.json({ brand: await getBrandSettings() });
  } catch (error) {
    if (isUnauthorized(error)) {
      return jsonError("Unauthorized", 401);
    }
    if (isForbidden(error)) {
      return jsonError("Forbidden", 403);
    }
    throw error;
  }
}
