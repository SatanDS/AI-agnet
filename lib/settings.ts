import { prisma } from "@/lib/prisma";

export const MODEL_OPTIONS = [
  { label: "GPT-5.5", value: "gpt-5.5" },
  { label: "GPT-5.4", value: "gpt-5.4" },
  { label: "GPT-5.4 mini", value: "gpt-5.4-mini" },
  { label: "GPT-5.3 Codex", value: "gpt-5.3-codex" },
  { label: "GPT-5.2", value: "gpt-5.2" },
] as const;

const SETTING_KEYS = [
  "MODEL_PROVIDER",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "LOCAL_OPENAI_BASE_URL",
  "LOCAL_OPENAI_API_KEY",
  "LOCAL_OPENAI_MODEL",
  "USER_CHAT_PRESET",
  "ADMIN_CHAT_PRESET",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export type ModelSettings = {
  MODEL_PROVIDER: "openai" | "local_openai";
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  LOCAL_OPENAI_BASE_URL: string;
  LOCAL_OPENAI_API_KEY: string;
  LOCAL_OPENAI_MODEL: string;
};

export type ChatPresetSettings = {
  USER_CHAT_PRESET: string;
  ADMIN_CHAT_PRESET: string;
};

export const DEFAULT_USER_PRESET =
  "你是一个受限问答助手。只回答管理员允许的业务范围内问题；如果用户问题超出范围，请礼貌说明无法回答，并引导用户回到允许的话题。";

export const DEFAULT_ADMIN_PRESET =
  "你是管理员辅助助手。优先帮助管理员处理系统、用户和业务配置相关问题；如果问题明显超出授权范围，请拒绝回答，并提示需要所有者确认。";

export async function getModelSettings(): Promise<ModelSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const provider = values.get("MODEL_PROVIDER") ?? process.env.MODEL_PROVIDER ?? "openai";

  return {
    MODEL_PROVIDER: provider === "local_openai" ? "local_openai" : "openai",
    OPENAI_API_KEY: values.get("OPENAI_API_KEY") ?? process.env.OPENAI_API_KEY ?? "",
    OPENAI_MODEL: values.get("OPENAI_MODEL") ?? process.env.OPENAI_MODEL ?? "gpt-5.5",
    LOCAL_OPENAI_BASE_URL:
      values.get("LOCAL_OPENAI_BASE_URL") ?? process.env.LOCAL_OPENAI_BASE_URL ?? "",
    LOCAL_OPENAI_API_KEY:
      values.get("LOCAL_OPENAI_API_KEY") ?? process.env.LOCAL_OPENAI_API_KEY ?? "",
    LOCAL_OPENAI_MODEL:
      values.get("LOCAL_OPENAI_MODEL") ?? process.env.LOCAL_OPENAI_MODEL ?? "local-model",
  };
}

export async function getChatPresetSettings(): Promise<ChatPresetSettings> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: ["USER_CHAT_PRESET", "ADMIN_CHAT_PRESET"] } },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    USER_CHAT_PRESET: values.get("USER_CHAT_PRESET") ?? DEFAULT_USER_PRESET,
    ADMIN_CHAT_PRESET: values.get("ADMIN_CHAT_PRESET") ?? DEFAULT_ADMIN_PRESET,
  };
}

export async function saveChatPresetSettings(settings: ChatPresetSettings) {
  await prisma.$transaction(
    Object.entries(settings).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );
}

export async function saveModelSettings(settings: ModelSettings) {
  await prisma.$transaction(
    Object.entries(settings).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );
}

export function maskSecret(value: string) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
