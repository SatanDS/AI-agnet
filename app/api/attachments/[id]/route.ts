import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isUnauthorized, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredAttachments } from "@/lib/attachments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    await cleanupExpiredAttachments().catch(() => undefined);
    const { id } = await context.params;

    const attachment = await prisma.messageAttachment.findFirst({
      where: {
        id,
        expiresAt: { gt: new Date() },
        ...(user.role === "owner"
          ? {}
          : {
              message: {
                conversation: {
                  userId: user.id,
                },
              },
            }),
      },
      select: {
        mimeType: true,
        storagePath: true,
      },
    });

    if (!attachment) {
      return jsonError("Attachment not found or expired.", 404);
    }

    const file = await readFile(attachment.storagePath).catch(() => null);
    if (!file) {
      return jsonError("Attachment file not found.", 404);
    }

    return new NextResponse(file, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (isUnauthorized(error)) {
      return jsonError("Unauthorized", 401);
    }
    throw error;
  }
}
