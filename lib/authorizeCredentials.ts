import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function authorizeCredentials(credentials: Partial<Record<"email" | "password", unknown>>) {
  const email = credentials?.email as string | undefined;
  const password = credentials?.password as string | undefined;
  if (!email || !password) return null;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { employee: true },
  });
  if (!user) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    companyId: user.companyId,
    employeeId: user.employee?.id ?? null,
  };
}
