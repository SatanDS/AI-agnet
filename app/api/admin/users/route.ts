import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  username: z.string().trim().min(2).max(40),
  password: z.string().min(8).max(200),
  isAdmin: z.boolean().default(false),
});

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        isAdmin: true,
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
    await requireAdmin();
    const parsed = createUserSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return jsonError("Invalid user data.", 400);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        passwordHash,
        isAdmin: parsed.data.isAdmin,
      },
      select: {
        id: true,
        username: true,
        isAdmin: true,
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
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return jsonError("Username already exists.", 409);
    }
    throw error;
  }
}
