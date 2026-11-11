import { prisma } from "@/lib/prisma";
import { canAssignRole } from "@/lib/roleHierarchy";
import { resolveEmployeeIdentity } from "@/lib/employeeIdentity";
import { WEAK_PASSWORD_MESSAGE, isStrongPassword } from "@/lib/passwordPolicy";
import type { Role } from "@prisma/client";
import bcrypt from "bcryptjs";

export type CreateEmployeeInput = {
  companyId: string;
  email?: string | null;
  name: string;
  password: string;
  departmentId: string | null;
  role: Role;
  externalEmployeeId?: string | null;
};

export type CreateEmployeeResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export async function createCompanyEmployee(
  input: CreateEmployeeInput,
  opts: { callerRole: Role | string }
): Promise<CreateEmployeeResult> {
  const { companyId, name, password, departmentId, role } = input;

  const identity = resolveEmployeeIdentity({
    companyId,
    email: input.email,
    externalEmployeeId: input.externalEmployeeId,
  });
  if (!identity.ok) {
    return { ok: false, code: identity.code, message: identity.message };
  }
  const { email, externalEmployeeId } = identity;

  if (departmentId) {
    const dep = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { companyId: true },
    });
    if (!dep || dep.companyId !== companyId) {
      return { ok: false, code: "INVALID_DEPARTMENT", message: "부서를 찾을 수 없습니다." };
    }
  }

  const dup = await prisma.user.findUnique({ where: { email } });
  if (dup) {
    return { ok: false, code: "EMAIL_TAKEN", message: "이미 등록된 이메일입니다." };
  }

  const idDup = await prisma.employee.findFirst({
    where: { companyId, externalEmployeeId },
    select: { id: true },
  });
  if (idDup) {
    return { ok: false, code: "EXTERNAL_ID_TAKEN", message: "이미 사용 중인 직원 ID입니다." };
  }

  if (!isStrongPassword(password)) {
    return {
      ok: false,
      code: "WEAK_PASSWORD",
      message: WEAK_PASSWORD_MESSAGE,
    };
  }

  if (role !== "EMPLOYEE" && !canAssignRole(opts.callerRole, "EMPLOYEE", role)) {
    return { ok: false, code: "ROLE_NOT_ALLOWED", message: "허용되지 않는 역할입니다." };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          companyId,
          email,
          passwordHash,
          role,
          consentGivenAt: null,
          consentVersion: null,
        },
      });
      await tx.employee.create({
        data: {
          companyId,
          userId: user.id,
          name: name.trim(),
          departmentId,
          externalEmployeeId,
        },
      });
    });
    return { ok: true };
  } catch {
    return { ok: false, code: "CREATE_FAILED", message: "생성에 실패했습니다." };
  }
}
