import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  username: z.string().trim().min(2).max(40),
  password: z.string().min(8).max(200),
  role: z.enum(["owner", "admin", "user"]).default("user"),
});

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
      return jsonError("Invalid user data.", 400);
    }

    if (actor.role !== "owner" && parsed.data.role !== "user") {
      return jsonError("Admins can only create normal users.", 403);
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        passwordHash,
        isAdmin: parsed.data.role !== "user",
        role: parsed.data.role,
      },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        role: true,
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
