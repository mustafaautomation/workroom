import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "wr_session";
const MAX_AGE = 60 * 60 * 24 * 14;

function secret() {
  return process.env.AUTH_SECRET || "workroom-public-demo-session-v1";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function readSession(): Promise<{ uid: string } | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const given = Buffer.from(signature);
  const target = Buffer.from(expected);
  if (given.length !== target.length || !timingSafeEqual(given, target)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: string;
      exp?: number;
    };
    if (!data.uid || typeof data.exp !== "number") return null;
    if (data.exp < Date.now() / 1000) return null;
    return { uid: data.uid };
  } catch {
    return null;
  }
}

export function sessionCookie(uid: string) {
  const payload = Buffer.from(
    JSON.stringify({ uid, exp: Math.floor(Date.now() / 1000) + MAX_AGE }),
  ).toString("base64url");
  return {
    name: COOKIE,
    value: `${payload}.${sign(payload)}`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: MAX_AGE,
    },
  };
}

export async function setSession(uid: string) {
  const cookie = sessionCookie(uid);
  const jar = await cookies();
  jar.set(cookie.name, cookie.value, cookie.options);
  jar.set("wr_demo", "", { path: "/", maxAge: 0 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { path: "/", maxAge: 0 });
}

export function signMagicToken(email: string) {
  const payload = Buffer.from(
    JSON.stringify({ email: email.toLowerCase(), exp: Date.now() + 30 * 60 * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyMagicToken(token: string): { email: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const given = Buffer.from(signature);
  const target = Buffer.from(expected);
  if (given.length !== target.length || !timingSafeEqual(given, target)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
      exp?: number;
    };
    if (!data.email || typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}
