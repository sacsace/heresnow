/** 플랫폼 루트(슈퍼 전용 운영 계정) — UI에 SUPER_ADMIN 대신 표시 */
export const PLATFORM_ROOT_EMAIL = "lee@msventures.in";

export function sessionRoleLabel(
  email: string | null | undefined,
  role: string,
  t: (path: string) => string
): string {
  if ((email ?? "").toLowerCase() === PLATFORM_ROOT_EMAIL.toLowerCase()) {
    return t("common.roleRoot");
  }
  const key =
    {
      SUPER_ADMIN: "common.roleSuperAdmin",
      COMPANY_ADMIN: "common.roleCompanyAdmin",
      HR_MANAGER: "common.roleHrManager",
      APPROVER: "common.roleApprover",
      EMPLOYEE: "common.roleEmployee",
      DOOR: "common.roleDoor",
    }[role] ?? null;
  return key ? t(key) : role;
}
