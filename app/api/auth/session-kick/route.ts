export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  consumeSessionKickNotice,
  SESSION_KICK_REASON_ANOTHER_DEVICE,
  validateUserSession,
} from "@/lib/userSessions";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

/** 세션 종료 사유 조회 — 다른 기기 로그인 안내용 */
export async function GET(req: Request) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ reason: null }, { status: 500 });
  }

  const token = await getToken({
    req,
    secret,
    secureCookie: process.env.NODE_ENV === "production",
  });

  const userId = token?.sub;
  const nonce = typeof token?.sessionNonce === "string" ? token.sessionNonce : null;
  if (!userId || !nonce) {
    return NextResponse.json({ reason: null });
  }

  try {
    const kickReason = await consumeSessionKickNotice(userId, nonce);
    if (kickReason === SESSION_KICK_REASON_ANOTHER_DEVICE) {
      return NextResponse.json({
        reason: SESSION_KICK_REASON_ANOTHER_DEVICE,
        active: false,
      });
    }

    const stillValid = await validateUserSession(userId, nonce);
    return NextResponse.json({ reason: null, active: stillValid });
  } catch (err) {
    console.error("[session-kick]", err);
    return NextResponse.json({ reason: null, active: true });
  }
}
