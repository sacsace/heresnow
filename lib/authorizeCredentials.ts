import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

export async function authorizeCredentials(credentials: Partial<Record<"email" | "password", unknown>>) {
  const email = credentials?.email as string | undefined;
  const password = credentials?.password as string | undefined;
  if (!email || !password) return null;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { employee: true },
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[auth] DB 연결 실패 — DATABASE_URL 확인", e);
    }
    return null;
  }
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  const sessionNonce = randomUUID();
  await prisma.user.update({
    where: { id: user.id },
    data: { sessionNonce },
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    companyId: user.companyId,
    employeeId: user.employee?.id ?? null,
    sessionNonce,
  };
}
