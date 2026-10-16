import { MAX_FACE_ENROLLMENTS } from "@/lib/faceEnrollmentGroups";

type FaceEnrollErrorPayload = {
  error?: unknown;
  conflictEmployeeName?: unknown;
};

/** POST /api/employee/face 등록 오류 → UI 로케일 문구 */
export function mapFaceEnrollApiError(
  errorOrPayload: unknown,
  t: (key: string) => string,
  maxEnrollments = MAX_FACE_ENROLLMENTS
): string {
  const payload: FaceEnrollErrorPayload =
    errorOrPayload != null && typeof errorOrPayload === "object"
      ? (errorOrPayload as FaceEnrollErrorPayload)
      : { error: errorOrPayload };

  const error = payload.error;
  const conflictName =
    typeof payload.conflictEmployeeName === "string" && payload.conflictEmployeeName.trim()
      ? payload.conflictEmployeeName.trim()
      : null;

  if (typeof error !== "string") return t("employee.faceEnrollFail");

  switch (error) {
    case "FACE_CONFLICT_OTHER_EMPLOYEE":
      if (conflictName) {
        return t("employee.faceEnrollConflictOtherNamed").replace("{name}", conflictName);
      }
      return t("employee.faceEnrollConflictOther");
    case "FACE_ENROLLMENT_LIMIT":
      return t("account.faceEnrollLimit").replace("{max}", String(maxEnrollments));
    default:
      if (/^[A-Z0-9_]+$/.test(error)) return t("employee.faceEnrollFail");
      return error;
  }
}
