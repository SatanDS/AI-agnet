import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isUnauthorized, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { deleteAttachmentFilesForConversation } from "@/lib/attachments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

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
    throw error;
  }
}
