import { prisma } from "@/lib/prisma";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/** 1회용 토큰 유효 시간 */
export const TOKEN_TTL_MS = 30_000;

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is required for face login tokens");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("hex");
}

function parseToken(token: string): { userId: string; exp: number; jti: string; sig: string } | null {
  const lastColon = token.lastIndexOf(":");
  if (lastColon <= 0) return null;

  const sig = token.slice(lastColon + 1);
  const payload = token.slice(0, lastColon);
  const parts = payload.split(":");
  if (parts.length !== 3) return null;

  const [userId, expStr, jti] = parts;
  const exp = Number(expStr);
  if (!userId || !jti || !Number.isFinite(exp)) return null;

  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  return { userId, exp, jti, sig };
}

/** 안면 매칭 성공 후 1회용 로그인 토큰 발급 */
export async function createFaceLoginToken(userId: string): Promise<string> {
  const jti = randomUUID();
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${userId}:${exp}:${jti}`;
  const token = `${payload}:${sign(payload)}`;

  await prisma.faceLoginToken.create({
    data: {
      jti,
      userId,
      expiresAt: new Date(exp),
    },
  });

  // 오래된 토큰 정리 (best-effort)
  void prisma.faceLoginToken
    .deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 3_600_000) } },
    })
    .catch(() => {});

  return token;
}

/** 서명·만료·미사용 확인 후 1회 소비. 성공 시 userId 반환 */
export async function consumeFaceLoginToken(token: string): Promise<string | null> {
  const parsed = parseToken(token);
  if (!parsed || Date.now() > parsed.exp) return null;

  const consumed = await prisma.faceLoginToken.updateMany({
    where: {
      jti: parsed.jti,
      userId: parsed.userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  if (consumed.count !== 1) return null;
  return parsed.userId;
}

/** @deprecated 테스트·호환 — consumeFaceLoginToken 사용 */
export function verifyFaceLoginToken(token: string): string | null {
  const parsed = parseToken(token);
  if (!parsed || Date.now() > parsed.exp) return null;
  return parsed.userId;
}
