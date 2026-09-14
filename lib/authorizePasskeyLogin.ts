import type { Role } from "@prisma/client";
import { verifyPasskeyLoginToken } from "@/lib/passkeyLoginToken";
import { parseStaySignedIn, sessionMaxAgeSec } from "@/lib/sessionDuration";
import { issueUserSession } from "@/lib/userSessions";
import { prisma } from "@/lib/prisma";

export async function authorizePasskeyLogin(
  credentials: Partial<Record<"loginToken" | "staySignedIn", unknown>>
) {
  const token = String(credentials?.loginToken ?? "").trim();
  if (!token) return null;

  let userId: string | null;
  try {
    userId = verifyPasskeyLoginToken(token);
  } catch {
    return null;
  }
  if (!userId) return null;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: { select: { id: true } } },
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth] DB 연결 실패 — DATABASE_URL 확인", e);
    }
    return null;
  }
  if (!user) return null;

  const staySignedIn = parseStaySignedIn(credentials.staySignedIn);
  const { sessionNonce } = await issueUserSession(user.id, sessionMaxAgeSec(staySignedIn));

  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    companyId: user.companyId,
    employeeId: user.employee?.id ?? null,
    sessionNonce,
    staySignedIn,
  };
}

