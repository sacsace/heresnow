import type { Role } from "@prisma/client";
import { verifyFaceLoginToken } from "@/lib/faceLoginToken";
import { prisma } from "@/lib/prisma";

export async function authorizeFaceLogin(
  credentials: Partial<Record<"loginToken", unknown>>
) {
  const token = String(credentials?.loginToken ?? "").trim();
  if (!token) return null;

  let userId: string | null;
  try {
    userId = verifyFaceLoginToken(token);
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
    console.error("[auth] DB 연결 실패 — .env 의 DATABASE_URL(비밀번호·호스트)을 확인하세요.", e);
    return null;
  }

  if (!user?.employee?.id) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    companyId: user.companyId,
    employeeId: user.employee.id,
  };
}
