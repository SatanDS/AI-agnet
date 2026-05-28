import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { encodeStreamChunk, streamModelResponse } from "@/lib/model";
import { isUnauthorized, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().trim().min(1).max(20000),
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

  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError("Invalid chat message.", 400);
  }

  const { conversationId, message } = parsed.data;
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

  if (conversation.title === "New chat") {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { title: titleFromMessage(message) },
    });
  }

  const history = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      content: true,
    },
  });
  const modelHistory = history.map((item) => ({
    role: item.role as "user" | "assistant" | "system",
    content: item.content,
  }));

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
        const message =
          error instanceof Error ? error.message : "The model request failed.";
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
  return compact.length > 24 ? `${compact.slice(0, 24)}...` : compact || "New chat";
}
