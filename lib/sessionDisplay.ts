/** 플랫폼 루트(슈퍼 전용 운영 계정) 로그인 식별자 */
export const PLATFORM_ROOT_IDENTIFIER = "root";

export function sessionRoleLabel(
  email: string | null | undefined,
  role: string,
  t: (path: string) => string
): string {
  // Root label is reserved only for the dedicated SUPER_ADMIN account
  // that logs in with identifier "root".
  if (role === "SUPER_ADMIN" && (email ?? "").trim() === PLATFORM_ROOT_IDENTIFIER) {
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
