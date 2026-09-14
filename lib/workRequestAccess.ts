import type { Role } from "@prisma/client";

/** 회사 전체 근태 신청·출퇴근 예외 관리 (관리자·승인자 역할) */
export function canManageWorkRequests(role: Role | undefined): boolean {
  return (
    role === "COMPANY_ADMIN" ||
    role === "HR_MANAGER" ||
    role === "APPROVER" ||
    role === "SUPER_ADMIN"
  );
}

/** 받은 신청 탭 노출 — 팀장 포함 */
export function canReceiveWorkRequests(
  role: Role | undefined,
  isTeamLeader: boolean
): boolean {
  return canManageWorkRequests(role) || isTeamLeader;
}

/** 단일 WorkRequest 승인/반려 권한 */
export function canApproveWorkRequest(params: {
  userId: string;
  role: Role | undefined;
  assignedApproverUserId: string | null | undefined;
}): boolean {
  const { userId, role, assignedApproverUserId } = params;
  if (
    role === "SUPER_ADMIN" ||
    role === "COMPANY_ADMIN" ||
    role === "HR_MANAGER" ||
    role === "APPROVER"
  ) {
    return true;
  }
  return Boolean(assignedApproverUserId && assignedApproverUserId === userId);
}
