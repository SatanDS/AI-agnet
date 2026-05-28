import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "ai_chat_session";
const SESSION_DAYS = 14;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
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
    secure: process.env.NODE_ENV === "production",
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

    return {
      id: session.user.id,
      username: session.user.username,
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
