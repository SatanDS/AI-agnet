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
  isAdmin: z.boolean().optional(),
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

    if (admin.id === id && parsed.data.isAdmin === false) {
      return jsonError("You cannot remove admin access from your own account.", 400);
    }

    if (target.isAdmin && parsed.data.isAdmin === false) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) {
        return jsonError("At least one admin account is required.", 400);
      }
    }

    const updateData: { passwordHash?: string; isAdmin?: boolean } = {};
    if (parsed.data.password) {
      updateData.passwordHash = await hashPassword(parsed.data.password);
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    if (typeof parsed.data.isAdmin === "boolean") {
      updateData.isAdmin = parsed.data.isAdmin;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        isAdmin: true,
        createdAt: true,
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

    if (target.isAdmin) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) {
        return jsonError("At least one admin account is required.", 400);
      }
    }

    await prisma.user.delete({ where: { id } });

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
