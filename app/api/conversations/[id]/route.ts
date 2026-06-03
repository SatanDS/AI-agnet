import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { deleteAttachmentFilesForConversation } from "@/lib/attachments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "对话名称不能为空。")
    .max(80, "对话名称不能超过 80 个字符。"),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateConversationSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        parsed.error.issues[0]?.message ?? "对话名称格式不正确。",
        400,
      );
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      select: { id: true, updatedAt: true },
    });

    if (!conversation) {
      return jsonError("对话不存在或无权编辑。", 404);
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        title: parsed.data.title,
        updatedAt: conversation.updatedAt,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ conversation: updatedConversation });
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    if (user.role !== "owner" && !user.canDeleteConversations) {
      return jsonError("当前账号已被限制删除对话。", 403);
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (conversation) {
      await deleteAttachmentFilesForConversation(conversation.id);
      await prisma.conversation.delete({ where: { id: conversation.id } });
    }

    return NextResponse.json({ ok: true });
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
