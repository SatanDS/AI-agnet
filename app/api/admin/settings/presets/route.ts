import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { getChatPresetSettings, saveChatPresetSettings } from "@/lib/settings";

const presetSchema = z.object({
  USER_CHAT_PRESET: z.string().trim().min(1).max(8000),
  ADMIN_CHAT_PRESET: z.string().trim().min(1).max(8000),
});

export async function GET() {
  try {
    await requireOwner();
    const presets = await getChatPresetSettings();
    return NextResponse.json({ presets });
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
    const parsed = presetSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return jsonError("Invalid preset settings.", 400);
    }

    await saveChatPresetSettings(parsed.data);
    return NextResponse.json({ presets: parsed.data });
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
