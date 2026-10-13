import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { apiKeys, sessions, users } from "@/db/schema";

export const SESSION_COOKIE = "ss_session";
const SESSION_DAYS = 30;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt: expires });
  return { token, expires };
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

async function userForSessionToken(token: string): Promise<AuthUser | null> {
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function userForApiKey(key: string): Promise<AuthUser | null> {
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, createdAt: users.createdAt, keyId: apiKeys.id })
    .from(apiKeys)
    .innerJoin(users, eq(users.id, apiKeys.userId))
    .where(and(eq(apiKeys.keyHash, sha256(key)), isNull(apiKeys.revokedAt)))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, r.keyId))
    .catch(() => undefined);
  return { id: r.id, email: r.email, name: r.name, createdAt: r.createdAt };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await userForSessionToken(token);
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<AuthUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function readSessionToken(req: Request): string | null {
  return parseCookie(req.headers.get("cookie") ?? "", SESSION_COOKIE);
}

export async function authenticateRequest(req: Request): Promise<{ user: AuthUser; via: "session" | "key" } | null> {
  const auth = req.headers.get("authorization");
  const xkey = req.headers.get("x-api-key");
  const key = auth && auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : xkey?.trim();
  if (key) {
    const user = await userForApiKey(key);
    return user ? { user, via: "key" } : null;
  }
  const token = readSessionToken(req);
  if (!token) return null;
  const user = await userForSessionToken(token);
  return user ? { user, via: "session" } : null;
}

export function sessionCookieOptions(req: Request, expires: Date | null) {
  // Proxies don't always forward x-forwarded-proto; browsers always send Origin on fetch POSTs.
  const fwd = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  const secure = fwd === "https" || origin.startsWith("https://") || new URL(req.url).protocol === "https:";
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? ("none" as const) : ("lax" as const),
    secure,
    ...(secure ? { partitioned: true } : {}),
    ...(expires ? { expires } : { maxAge: 0 }),
  };
}

export function generateApiKey() {
  const token = `ss_live_${randomBytes(24).toString("base64url")}`;
  return { token, prefix: token.slice(0, 12), hash: sha256(token) };
}
