import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export type BrandSettings = {
  logoUrl: string | null;
  logoUpdatedAt: string;
};

const BRAND_LOGO_FILE = "BRAND_LOGO_FILE";
const BRAND_LOGO_MIME_TYPE = "BRAND_LOGO_MIME_TYPE";
const BRAND_LOGO_UPDATED_AT = "BRAND_LOGO_UPDATED_AT";
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function brandRoot() {
  return path.join(process.cwd(), "data", "brand");
}

export async function getBrandSettings(): Promise<BrandSettings> {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: { in: [BRAND_LOGO_FILE, BRAND_LOGO_UPDATED_AT] },
    },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const logoFile = values.get(BRAND_LOGO_FILE);
  const logoUpdatedAt = values.get(BRAND_LOGO_UPDATED_AT) ?? "";

  return {
    logoUrl: logoFile ? `/api/brand/logo?v=${encodeURIComponent(logoUpdatedAt)}` : null,
    logoUpdatedAt,
  };
}

export async function getBrandLogoFile() {
  const rows = await prisma.appSetting.findMany({
    where: {
      key: { in: [BRAND_LOGO_FILE, BRAND_LOGO_MIME_TYPE] },
    },
  });
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const fileName = values.get(BRAND_LOGO_FILE);
  const mimeType = values.get(BRAND_LOGO_MIME_TYPE);

  if (!fileName || !mimeType) {
    return null;
  }

  const storagePath = path.join(brandRoot(), fileName);
  const file = await readFile(storagePath).catch(() => null);
  if (!file) {
    return null;
  }

  return { file, mimeType };
}

export async function saveBrandLogo(file: File) {
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    throw new Error("仅支持 PNG、JPG 或 WEBP logo。");
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new Error("Logo 不能超过 2MB。");
  }

  await mkdir(brandRoot(), { recursive: true });
  await clearBrandLogoFiles();

  const fileName = `logo${extensionForMimeType(file.type)}`;
  const storagePath = path.join(brandRoot(), fileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  const updatedAt = new Date().toISOString();

  await writeFile(storagePath, bytes);
  await prisma.$transaction([
    prisma.appSetting.upsert({
      where: { key: BRAND_LOGO_FILE },
      update: { value: fileName },
      create: { key: BRAND_LOGO_FILE, value: fileName },
    }),
    prisma.appSetting.upsert({
      where: { key: BRAND_LOGO_MIME_TYPE },
      update: { value: file.type },
      create: { key: BRAND_LOGO_MIME_TYPE, value: file.type },
    }),
    prisma.appSetting.upsert({
      where: { key: BRAND_LOGO_UPDATED_AT },
      update: { value: updatedAt },
      create: { key: BRAND_LOGO_UPDATED_AT, value: updatedAt },
    }),
  ]);

  return getBrandSettings();
}

export async function deleteBrandLogo() {
  await clearBrandLogoFiles();
  await prisma.appSetting.deleteMany({
    where: {
      key: {
        in: [BRAND_LOGO_FILE, BRAND_LOGO_MIME_TYPE, BRAND_LOGO_UPDATED_AT],
      },
    },
  });
}

async function clearBrandLogoFiles() {
  await Promise.all(
    ["logo.png", "logo.jpg", "logo.webp"].map((fileName) =>
      rm(path.join(brandRoot(), fileName), { force: true }).catch(() => undefined),
    ),
  );
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  if (mimeType === "image/webp") {
    return ".webp";
  }
  return ".png";
}
