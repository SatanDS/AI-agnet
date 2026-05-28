import { z } from "zod";

const envSchema = z.object({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters."),
  MODEL_PROVIDER: z.enum(["openai", "local_openai"]).default("openai"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.5"),
  LOCAL_OPENAI_BASE_URL: z.string().url().optional(),
  LOCAL_OPENAI_API_KEY: z.string().optional(),
  LOCAL_OPENAI_MODEL: z.string().default("local-model"),
});

export function getConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${message}`);
  }

  const config = parsed.data;

  if (config.MODEL_PROVIDER === "openai" && !config.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when MODEL_PROVIDER=openai.");
  }

  if (config.MODEL_PROVIDER === "local_openai" && !config.LOCAL_OPENAI_BASE_URL) {
    throw new Error(
      "LOCAL_OPENAI_BASE_URL is required when MODEL_PROVIDER=local_openai.",
    );
  }

  return config;
}
