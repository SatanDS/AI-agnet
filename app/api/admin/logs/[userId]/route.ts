import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { cleanupExpiredAttachments } from "@/lib/attachments";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireOwner();
    await cleanupExpiredAttachments().catch(() => undefined);
    const { userId } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    if (!user) {
      return jsonError("User archive is no longer attached to an active user.", 404);
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        updatedAt: true,
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

    return NextResponse.json({ user, conversations });
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
