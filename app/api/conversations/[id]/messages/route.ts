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
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        title: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            attachments: {
              where: { expiresAt: { gt: new Date() } },
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                originalName: true,
                mimeType: true,
                sizeBytes: true,
                expiresAt: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return jsonError("Conversation not found.", 404);
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    if (isUnauthorized(error)) {
      return jsonError("Unauthorized", 401);
    }
    throw error;
  }
}
