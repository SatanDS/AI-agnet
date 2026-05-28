import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "ai_chat_session";
const SESSION_DAYS = 14;

export type UserRole = "owner" | "admin" | "user";

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

function shouldUseSecureCookie() {
  if (process.env.AUTH_COOKIE_SECURE === "true") {
    return true;
  }

  if (process.env.AUTH_COOKIE_SECURE === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  });

  const token = await new SignJWT({ sid: session.id, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getAuthSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(),
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const session = await readSessionToken(token).catch(() => null);
    if (session?.sid) {
      await prisma.session.deleteMany({ where: { id: session.sid } });
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}

async function readSessionToken(token: string) {
  const verified = await jwtVerify(token, getAuthSecret());
  const payload = verified.payload;

  if (typeof payload.sid !== "string" || typeof payload.uid !== "string") {
    throw new Error("Invalid session token.");
  }

  return { sid: payload.sid, uid: payload.uid };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await readSessionToken(token);
    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (!session || session.userId !== payload.uid || session.expiresAt < new Date()) {
      return null;
    }

    const role = normalizeRole(session.user.role);

    return {
      id: session.user.id,
      username: session.user.username,
      isAdmin: session.user.isAdmin,
      role,
    };
  } catch {
    return null;
  }
}

function normalizeRole(role: string): UserRole {
  if (role === "owner" || role === "admin") {
    return role;
  }

  return "user";
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "owner" && user.role !== "admin") {
    throw new Error("Forbidden");
  }

  return user;
}

export async function requireOwner() {
  const user = await requireUser();

  if (user.role !== "owner") {
    throw new Error("Forbidden");
  }

  return user;
}
