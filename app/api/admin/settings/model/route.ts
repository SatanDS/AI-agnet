import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import {
  getModelSettings,
  maskSecret,
  MODEL_OPTIONS,
  saveModelSettings,
} from "@/lib/settings";

const settingsSchema = z.object({
  MODEL_PROVIDER: z.enum(["openai", "local_openai"]),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().trim().min(1),
  LOCAL_OPENAI_BASE_URL: z.string().trim().optional(),
  LOCAL_OPENAI_API_KEY: z.string().optional(),
  LOCAL_OPENAI_MODEL: z.string().trim().min(1),
});

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getModelSettings();

    return NextResponse.json({
      settings: {
        ...settings,
        OPENAI_API_KEY_MASKED: maskSecret(settings.OPENAI_API_KEY),
        LOCAL_OPENAI_API_KEY_MASKED: maskSecret(settings.LOCAL_OPENAI_API_KEY),
        OPENAI_API_KEY: "",
        LOCAL_OPENAI_API_KEY: "",
      },
      modelOptions: MODEL_OPTIONS,
    });
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
    await requireAdmin();
    const parsed = settingsSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return jsonError("Invalid model settings.", 400);
    }

    const current = await getModelSettings();
    const next = {
      MODEL_PROVIDER: parsed.data.MODEL_PROVIDER,
      OPENAI_API_KEY:
        parsed.data.OPENAI_API_KEY && parsed.data.OPENAI_API_KEY.trim()
          ? parsed.data.OPENAI_API_KEY.trim()
          : current.OPENAI_API_KEY,
      OPENAI_MODEL: parsed.data.OPENAI_MODEL,
      LOCAL_OPENAI_BASE_URL: parsed.data.LOCAL_OPENAI_BASE_URL?.trim() ?? "",
      LOCAL_OPENAI_API_KEY:
        parsed.data.LOCAL_OPENAI_API_KEY && parsed.data.LOCAL_OPENAI_API_KEY.trim()
          ? parsed.data.LOCAL_OPENAI_API_KEY.trim()
          : current.LOCAL_OPENAI_API_KEY,
      LOCAL_OPENAI_MODEL: parsed.data.LOCAL_OPENAI_MODEL,
    };

    if (next.MODEL_PROVIDER === "openai" && !next.OPENAI_API_KEY) {
      return jsonError("OpenAI API key is required.", 400);
    }

    if (next.MODEL_PROVIDER === "local_openai" && !next.LOCAL_OPENAI_BASE_URL) {
      return jsonError("Local model base URL is required.", 400);
    }

    await saveModelSettings(next);

    return NextResponse.json({
      settings: {
        ...next,
        OPENAI_API_KEY_MASKED: maskSecret(next.OPENAI_API_KEY),
        LOCAL_OPENAI_API_KEY_MASKED: maskSecret(next.LOCAL_OPENAI_API_KEY),
        OPENAI_API_KEY: "",
        LOCAL_OPENAI_API_KEY: "",
      },
    });
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
