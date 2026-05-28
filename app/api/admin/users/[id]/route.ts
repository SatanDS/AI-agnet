import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateUserSchema = z.object({
  password: z.string().min(8).max(200).optional(),
  role: z.enum(["owner", "admin", "user"]).optional(),
  chatPreset: z.string().trim().max(8000).nullish(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return jsonError("Invalid user data.", 400);
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return jsonError("User not found.", 404);
    }

    if (admin.role !== "owner" && target.role !== "user") {
      return jsonError("Admins can only manage normal users.", 403);
    }

    if (admin.role !== "owner" && parsed.data.role && parsed.data.role !== "user") {
      return jsonError("Admins can only assign normal user role.", 403);
    }

    if (admin.id === id && parsed.data.role && parsed.data.role !== admin.role) {
      return jsonError("You cannot change your own role.", 400);
    }

    if (target.role === "owner" && parsed.data.role && parsed.data.role !== "owner") {
      const ownerCount = await prisma.user.count({ where: { role: "owner" } });
      if (ownerCount <= 1) {
        return jsonError("At least one owner account is required.", 400);
      }
    }

    const updateData: {
      passwordHash?: string;
      isAdmin?: boolean;
      role?: string;
      chatPreset?: string | null;
    } = {};
    if (parsed.data.password) {
      updateData.passwordHash = await hashPassword(parsed.data.password);
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    if (parsed.data.role) {
      updateData.role = parsed.data.role;
      updateData.isAdmin = parsed.data.role !== "user";
      if (parsed.data.role === "owner") {
        updateData.chatPreset = null;
      }
    }
    if (parsed.data.chatPreset !== undefined) {
      if (target.role === "owner" || parsed.data.role === "owner") {
        return jsonError("Owner accounts do not use chat presets.", 400);
      }
      updateData.chatPreset = parsed.data.chatPreset || null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        isAdmin: true,
        role: true,
        chatPreset: true,
        createdAt: true,
        _count: {
          select: { conversations: true },
        },
      },
    });

    if (admin.id === id && parsed.data.password) {
      return NextResponse.json({ user, selfPasswordChanged: true });
    }

    return NextResponse.json({ user });
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
    const admin = await requireAdmin();
    const { id } = await context.params;

    if (admin.id === id) {
      return jsonError("You cannot delete your own account.", 400);
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return jsonError("User not found.", 404);
    }

    if (admin.role !== "owner" && target.role !== "user") {
      return jsonError("Admins can only delete normal users.", 403);
    }

    if (target.role === "owner") {
      const ownerCount = await prisma.user.count({ where: { role: "owner" } });
      if (ownerCount <= 1) {
        return jsonError("At least one owner account is required.", 400);
      }
    }

    await prisma.$transaction([
      prisma.behaviorLog.updateMany({
        where: { userId: id },
        data: { userId: null },
      }),
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.message.deleteMany({
        where: { conversation: { userId: id } },
      }),
      prisma.conversation.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

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
