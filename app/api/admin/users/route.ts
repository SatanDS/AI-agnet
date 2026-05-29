import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  username: z.string().trim().min(2).max(40),
  password: z.string().min(8).max(200),
  role: z.enum(["owner", "admin", "user"]).default("user"),
  chatPreset: z.string().trim().max(8000).optional(),
  canDeleteConversations: z.boolean().optional(),
});

const createUserErrorMessages: Record<string, string> = {
  username: "账号需要填写 2-40 个字符。",
  password: "密码需要至少 8 位，最多 200 位。",
  role: "请选择有效身份：所有者、管理员或普通用户。",
  chatPreset: "聊天预设不能超过 8000 个字符。",
  canDeleteConversations: "删除对话权限必须是开启或关闭。",
};

export async function GET() {
  try {
    const actor = await requireAdmin();
    const users = await prisma.user.findMany({
      where: actor.role === "owner" ? undefined : { role: "user" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        role: true,
        chatPreset: true,
        canDeleteConversations: true,
        createdAt: true,
        _count: {
          select: { conversations: true },
        },
      },
    });

    return NextResponse.json({ users });
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

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const parsed = createUserSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return jsonError(formatCreateUserError(parsed.error), 400);
    }

    if (actor.role !== "owner" && parsed.data.role !== "user") {
      return jsonError("创建失败：管理员只能创建普通用户，不能创建管理员或所有者账号。", 403);
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: parsed.data.username },
      select: { id: true },
    });

    if (existingUser) {
      return jsonError("创建失败：该账号已存在，请换一个账号名。", 409);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        passwordHash,
        isAdmin: parsed.data.role !== "user",
        role: parsed.data.role,
        chatPreset:
          parsed.data.role === "owner" ? null : parsed.data.chatPreset || null,
        canDeleteConversations:
          parsed.data.role === "owner"
            ? true
            : parsed.data.canDeleteConversations ?? true,
      },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        role: true,
        chatPreset: true,
        canDeleteConversations: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (isUnauthorized(error)) {
      return jsonError("Unauthorized", 401);
    }
    if (isForbidden(error)) {
      return jsonError("Forbidden", 403);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError("创建失败：该账号已存在，请换一个账号名。", 409);
    }
    throw error;
  }
}

function formatCreateUserError(error: z.ZodError) {
  const reasons = error.issues.map((issue) => {
    const field = String(issue.path[0] ?? "");
    return createUserErrorMessages[field] ?? issue.message;
  });
  const uniqueReasons = Array.from(new Set(reasons));

  return `创建失败：${uniqueReasons.join(" ")}`;
}
