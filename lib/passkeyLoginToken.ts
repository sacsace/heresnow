import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 60_000;

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is required for passkey login tokens");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("hex");
}

export function createPasskeyLoginToken(userId: string): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${exp}`;
  return `${payload}:${sign(payload)}`;
}

export function verifyPasskeyLoginToken(token: string): string | null {
  const lastColon = token.lastIndexOf(":");
  if (lastColon <= 0) return null;

  const sig = token.slice(lastColon + 1);
  const payload = token.slice(0, lastColon);
  const sep = payload.indexOf(":");
  if (sep <= 0) return null;

  const userId = payload.slice(0, sep);
  const exp = Number(payload.slice(sep + 1));
  if (!userId || !Number.isFinite(exp) || Date.now() > exp) return null;

  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return userId;
}

