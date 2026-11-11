import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { parseStaySignedIn, sessionMaxAgeSec } from "@/lib/sessionDuration";
import { issueUserSession } from "@/lib/userSessions";
import { prisma } from "@/lib/prisma";

export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password" | "staySignedIn", unknown>>
) {
  const loginId = ((credentials?.email as string | undefined) ?? "").trim();
  const password = credentials?.password as string | undefined;
  if (!loginId || !password) return null;

  const normalized = loginId.toLowerCase();

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: normalized },
      include: { employee: true },
    });

    // 이메일 대신 직원 ID로 로그인 (회사 간 동일 ID가 2건 이상이면 거부)
    if (!user) {
      const matches = await prisma.employee.findMany({
        where: {
          externalEmployeeId: { equals: loginId, mode: "insensitive" },
        },
        include: { user: true },
        take: 3,
      });
      if (matches.length === 1) {
        user = { ...matches[0].user, employee: matches[0] };
      } else if (matches.length > 1) {
        return null;
      }
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth] DB 연결 실패 — DATABASE_URL 확인", e);
    }
    return null;
  }
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

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
