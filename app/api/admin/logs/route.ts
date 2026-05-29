import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { isForbidden, isUnauthorized, jsonError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type LogArchive = {
  key: string;
  userId: string | null;
  username: string;
  role: string;
  latestContent: string;
  latestAt: Date;
  questionCount: number;
};

export async function GET() {
  try {
    await requireOwner();
    const logs = await prisma.behaviorLog.findMany({
      where: {
        userId: { not: null },
        user: { isNot: null },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        userId: true,
        username: true,
        role: true,
        action: true,
        content: true,
        createdAt: true,
      },
    });

    const archiveMap = new Map<string, LogArchive>();

    for (const log of logs) {
      if (!log.userId) {
        continue;
      }

      const key = log.userId;
      const existing = archiveMap.get(key);

      if (!existing) {
        archiveMap.set(key, {
          key,
          userId: log.userId,
          username: log.username,
          role: log.role,
          latestContent: log.content,
          latestAt: log.createdAt,
          questionCount: 1,
        });
        continue;
      }

      existing.questionCount += 1;
      if (log.createdAt > existing.latestAt) {
        existing.latestAt = log.createdAt;
        existing.latestContent = log.content;
        existing.role = log.role;
      }
    }

    const archives = Array.from(archiveMap.values()).sort(
      (left, right) => right.latestAt.getTime() - left.latestAt.getTime(),
    );

    return NextResponse.json({ archives, logs });
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
