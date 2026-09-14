import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

/** 근태 신청 승인권자로 선택 가능한 역할 */
export const WORK_REQUEST_APPROVER_ROLES: Role[] = [
  "APPROVER",
  "HR_MANAGER",
  "COMPANY_ADMIN",
];

export type WorkRequestApproverOption = {
  userId: string;
  name: string;
  role: Role;
  isTeamLeader: boolean;
};

export async function listWorkRequestApproverOptions(
  companyId: string,
  excludeUserId?: string
): Promise<WorkRequestApproverOption[]> {
  const rows = await prisma.employee.findMany({
    where: {
      companyId,
      user: { role: { not: "DOOR" } },
      OR: [{ isTeamLeader: true }, { user: { role: { in: WORK_REQUEST_APPROVER_ROLES } } }],
      ...(excludeUserId ? { NOT: { userId: excludeUserId } } : {}),
    },
    select: {
      name: true,
      isTeamLeader: true,
      user: { select: { id: true, role: true } },
    },
    orderBy: [{ isTeamLeader: "desc" }, { name: "asc" }],
  });

  return rows.map((row) => ({
    userId: row.user.id,
    name: row.name,
    role: row.user.role,
    isTeamLeader: row.isTeamLeader,
  }));
}

export async function isValidWorkRequestApprover(
  companyId: string,
  approverUserId: string,
  excludeUserId?: string
): Promise<boolean> {
  if (excludeUserId && approverUserId === excludeUserId) return false;

  const row = await prisma.employee.findFirst({
    where: { companyId, userId: approverUserId },
    select: {
      isTeamLeader: true,
      user: { select: { role: true } },
    },
  });
  if (!row) return false;
  if (row.isTeamLeader) return true;
  return WORK_REQUEST_APPROVER_ROLES.includes(row.user.role);
}
