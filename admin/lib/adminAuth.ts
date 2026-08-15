import "server-only";
import crypto from "node:crypto";

export const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sign(payload: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET!;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionToken(username: string): string {
  const payload = Buffer.from(JSON.stringify({ username, expires: Date.now() + SESSION_TTL_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string | undefined | null): { username: string; expires: number } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = sign(payload);
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof decoded.username !== "string" || typeof decoded.expires !== "number") return null;
    return decoded;
  } catch {
    return null;
  }
}

export function isValidSessionToken(token: string | undefined | null): boolean {
  const decoded = parseToken(token);
  return decoded !== null && Date.now() <= decoded.expires;
}

export function getSessionUsername(token: string | undefined | null): string | null {
  const decoded = parseToken(token);
  if (!decoded || Date.now() > decoded.expires) return null;
  return decoded.username;
}
