import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type PendingAttachment = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
};

export type StoredAttachmentForModel = {
  id: string;
  mimeType: string;
  dataUrl: string;
};

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ATTACHMENT_TTL_DAYS = 7;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function uploadRoot() {
  return path.join(process.cwd(), "data", "uploads");
}

export async function cleanupExpiredAttachments() {
  const expired = await prisma.messageAttachment.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, storagePath: true },
    take: 200,
  });

  if (expired.length === 0) {
    return;
  }

  await Promise.all(
    expired.map((attachment) =>
      rm(attachment.storagePath, { force: true }).catch(() => undefined),
    ),
  );
  await prisma.messageAttachment.deleteMany({
    where: { id: { in: expired.map((attachment) => attachment.id) } },
  });
}

export async function parseImageAttachments(formData: FormData) {
  const files = formData
    .getAll("images")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (files.length > 1) {
    throw new Error("一次最多上传 1 张图片。");
  }

  const attachments: PendingAttachment[] = [];
  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error("仅支持 PNG、JPG、WEBP 或 GIF 图片。");
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("图片不能超过 8MB。");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    attachments.push({
      originalName: file.name || "image",
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl: `data:${file.type};base64,${buffer.toString("base64")}`,
    });
  }

  return attachments;
}

export async function saveMessageAttachments(
  messageId: string,
  attachments: PendingAttachment[],
) {
  if (attachments.length === 0) {
    return [];
  }

  await mkdir(uploadRoot(), { recursive: true });
  const expiresAt = new Date(
    Date.now() + ATTACHMENT_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const created = [];
  for (const attachment of attachments) {
    const extension = extensionForMimeType(attachment.mimeType);
    const fileName = `${messageId}-${randomUUID()}${extension}`;
    const storagePath = path.join(uploadRoot(), fileName);
    const base64 = attachment.dataUrl.split(",")[1] ?? "";

    await writeFile(storagePath, Buffer.from(base64, "base64"));
    created.push(
      await prisma.messageAttachment.create({
        data: {
          messageId,
          fileName,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          storagePath,
          expiresAt,
        },
      }),
    );
  }

  return created;
}

export async function attachmentsForModel(messageId: string) {
  const rows = await prisma.messageAttachment.findMany({
    where: {
      messageId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "asc" },
  });

  const attachments: StoredAttachmentForModel[] = [];
  for (const row of rows) {
    const bytes = await readFile(row.storagePath).catch(() => null);
    if (!bytes) {
      continue;
    }

    attachments.push({
      id: row.id,
      mimeType: row.mimeType,
      dataUrl: `data:${row.mimeType};base64,${bytes.toString("base64")}`,
    });
  }

  return attachments;
}

export async function deleteAttachmentFilesForConversation(conversationId: string) {
  const attachments = await prisma.messageAttachment.findMany({
    where: { message: { conversationId } },
    select: { storagePath: true },
  });

  await Promise.all(
    attachments.map((attachment) =>
      rm(attachment.storagePath, { force: true }).catch(() => undefined),
    ),
  );
}

export async function deleteAttachmentFilesForUser(userId: string) {
  const attachments = await prisma.messageAttachment.findMany({
    where: { message: { conversation: { userId } } },
    select: { storagePath: true },
  });

  await Promise.all(
    attachments.map((attachment) =>
      rm(attachment.storagePath, { force: true }).catch(() => undefined),
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
  if (mimeType === "image/gif") {
    return ".gif";
  }
  return ".png";
}
