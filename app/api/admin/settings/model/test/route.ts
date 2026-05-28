import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import {
  listOpenAICompatibleModels,
  testOpenAICompatibleChat,
} from "@/lib/model";
import { getModelSettings } from "@/lib/settings";

const testSchema = z.object({
  MODEL_PROVIDER: z.enum(["openai", "local_openai"]),
  LOCAL_OPENAI_BASE_URL: z.string().trim().optional(),
  LOCAL_OPENAI_API_KEY: z.string().optional(),
  LOCAL_OPENAI_MODEL: z.string().trim().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await requireOwner();
    const parsed = testSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return jsonError("Invalid model test settings.", 400);
    }

    if (parsed.data.MODEL_PROVIDER !== "local_openai") {
      return jsonError("Model test is only available for local-compatible providers.", 400);
    }

    const current = await getModelSettings();
    const baseUrl =
      parsed.data.LOCAL_OPENAI_BASE_URL?.trim() || current.LOCAL_OPENAI_BASE_URL;
    const apiKey =
      parsed.data.LOCAL_OPENAI_API_KEY?.trim() ||
      current.LOCAL_OPENAI_API_KEY ||
      parsed.data.OPENAI_API_KEY?.trim() ||
      current.OPENAI_API_KEY;
    const model = parsed.data.LOCAL_OPENAI_MODEL?.trim() || current.LOCAL_OPENAI_MODEL;

    if (!baseUrl) {
      return jsonError("Base URL is required.", 400);
    }

    const models = await listOpenAICompatibleModels({ baseUrl, apiKey });

    if (model) {
      await testOpenAICompatibleChat({ baseUrl, apiKey, model });
    }

    return NextResponse.json({ ok: true, models });
  } catch (error) {
    if (isUnauthorized(error)) {
      return jsonError("Unauthorized", 401);
    }
    if (isForbidden(error)) {
      return jsonError("Forbidden", 403);
    }

    return jsonError(error instanceof Error ? error.message : "Model test failed.", 502);
  }
}
