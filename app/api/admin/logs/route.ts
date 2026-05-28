import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireOwner();
    const logs = await prisma.behaviorLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        username: true,
        role: true,
        action: true,
        content: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ logs });
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
