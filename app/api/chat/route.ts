import { z } from "zod";
import { requireUser, UserRole } from "@/lib/auth";
import {
  ChatMessage,
  encodeStreamChunk,
  streamModelResponse,
} from "@/lib/model";
import { isUnauthorized, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getChatPresetSettings } from "@/lib/settings";
import {
  PendingAttachment,
  attachmentsForModel,
  cleanupExpiredAttachments,
  parseImageAttachments,
  saveMessageAttachments,
} from "@/lib/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatSchema = z.object({
  conversationId: z.string().nullish(),
  message: z.string().trim().max(20000),
});

export async function POST(request: Request) {
  let user;

  try {
    user = await requireUser();
  } catch (error) {
    if (isUnauthorized(error)) {
      return jsonError("Unauthorized", 401);
    }
    throw error;
  }

  await cleanupExpiredAttachments().catch(() => undefined);

  let rawPayload: unknown;
  let pendingAttachments: PendingAttachment[] = [];

  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return jsonError("Invalid chat message.", 400);
    }

    try {
      pendingAttachments = await parseImageAttachments(formData);
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Invalid image attachment.",
        400,
      );
    }

    rawPayload = {
      conversationId: formData.get("conversationId"),
      message: formData.get("message"),
    };
  } else {
    rawPayload = await request.json().catch(() => null);
  }

  const parsed = chatSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return jsonError("Invalid chat message.", 400);
  }

  const conversationId = parsed.data.conversationId ?? undefined;
  const message =
    parsed.data.message || (pendingAttachments.length ? "请分析这张图片。" : "");
  if (!message.trim() && pendingAttachments.length === 0) {
    return jsonError("Invalid chat message.", 400);
  }
  let conversation = conversationId
    ? await prisma.conversation.findFirst({
        where: { id: conversationId, userId: user.id },
      })
    : null;

  if (conversationId && !conversation) {
    return jsonError("Conversation not found.", 404);
  }

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: titleFromMessage(message),
      },
    });
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: message,
    },
  });
  const userAttachments = await saveMessageAttachments(
    userMessage.id,
    pendingAttachments,
  );

  await prisma.behaviorLog.create({
    data: {
      userId: user.id,
      username: user.username,
      role: user.role,
      action: "chat_question",
      content: message,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      title:
        conversation.title === "New chat" || conversation.title === "新对话"
          ? titleFromMessage(message)
          : conversation.title,
      updatedAt: new Date(),
    },
  });

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
    },
  });
  const preset = await getPresetForUser(user.id, user.role);
  const imageAttachments = userAttachments.length
    ? await attachmentsForModel(userMessage.id)
    : [];
  const modelHistory: ChatMessage[] = history.map((item) => {
    const isCurrentUserMessage = item.id === userMessage.id;
    return {
      role: item.role as "user" | "assistant" | "system",
      content: item.content,
      images: isCurrentUserMessage
        ? imageAttachments.map((attachment) => ({
            dataUrl: attachment.dataUrl,
            mimeType: attachment.mimeType,
          }))
        : undefined,
    };
  });
  if (preset) {
    modelHistory.unshift({
      role: "system",
      content: preset,
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";

      controller.enqueue(
        encodeStreamChunk({
          text: "",
        }),
      );
      controller.enqueue(
        encodeStreamChunk({
          meta: {
            conversationId: conversation!.id,
            userMessageId: userMessage.id,
            userAttachmentCount: String(userAttachments.length),
          },
        }),
      );

      try {
        for await (const text of streamModelResponse(modelHistory)) {
          assistantText += text;
          controller.enqueue(encodeStreamChunk({ text }));
        }

        const assistantMessage = await prisma.message.create({
          data: {
            conversationId: conversation!.id,
            role: "assistant",
            content: assistantText,
          },
        });

        await prisma.conversation.update({
          where: { id: conversation!.id },
          data: { updatedAt: new Date() },
        });

        controller.enqueue(
          encodeStreamChunk({
            meta: {
              assistantMessageId: assistantMessage.id,
            },
          }),
        );
        controller.enqueue(encodeStreamChunk({ done: true }));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "模型请求失败。";
        controller.enqueue(encodeStreamChunk({ text: `\n\n[Error] ${message}` }));
        controller.enqueue(encodeStreamChunk({ done: true }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Conversation-Id": conversation.id,
    },
  });
}

function titleFromMessage(message: string) {
  const compact = message.replace(/\s+/g, " ").trim();
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact || "新对话";
}

async function getPresetForUser(userId: string, role: UserRole) {
  if (role === "owner") {
    return "";
  }

  const userPreset = await prisma.user.findUnique({
    where: { id: userId },
    select: { chatPreset: true },
  });
  const personalPreset = userPreset?.chatPreset?.trim();
  if (personalPreset) {
    return personalPreset;
  }

  const presets = await getChatPresetSettings();
  return role === "admin" ? presets.ADMIN_CHAT_PRESET : presets.USER_CHAT_PRESET;
}
