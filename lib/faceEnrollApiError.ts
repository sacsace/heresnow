import { MAX_FACE_ENROLLMENTS } from "@/lib/faceEnrollmentGroups";

/** POST /api/employee/face 등록 오류 → UI 로케일 문구 */
export function mapFaceEnrollApiError(
  error: unknown,
  t: (key: string) => string,
  maxEnrollments = MAX_FACE_ENROLLMENTS
): string {
  if (typeof error !== "string") return t("employee.faceEnrollFail");

  switch (error) {
    case "FACE_CONFLICT_OTHER_EMPLOYEE":
      return t("employee.faceEnrollConflictOther");
    case "FACE_ENROLLMENT_LIMIT":
      return t("account.faceEnrollLimit").replace("{max}", String(maxEnrollments));
    default:
      if (/^[A-Z0-9_]+$/.test(error)) return t("employee.faceEnrollFail");
      return error;
  }
}
