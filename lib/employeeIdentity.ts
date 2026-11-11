/** 메일 없이 직원 ID만 등록할 때 User.email 자리 표시용 도메인 (로그인·MVS에는 실제 메일로 취급하지 않음) */
export const SYNTHETIC_EMPLOYEE_EMAIL_DOMAIN = "employee.local";

export function emailLocalPart(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return trimmed.slice(0, 80);
  return trimmed.slice(0, at).slice(0, 80);
}

export function isSyntheticEmployeeEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const lower = email.trim().toLowerCase();
  return lower.endsWith(`@${SYNTHETIC_EMPLOYEE_EMAIL_DOMAIN}`);
}

export function displayEmployeeEmail(email: string | null | undefined): string {
  if (!email || isSyntheticEmployeeEmail(email)) return "";
  return email;
}

function sanitizeExternalIdForEmail(externalEmployeeId: string): string {
  return externalEmployeeId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildSyntheticEmployeeEmail(
  companyId: string,
  externalEmployeeId: string
): string {
  const id = sanitizeExternalIdForEmail(externalEmployeeId) || "unknown";
  return `id.${companyId}.${id}@${SYNTHETIC_EMPLOYEE_EMAIL_DOMAIN}`;
}

export type ResolvedEmployeeIdentity =
  | {
      ok: true;
      email: string;
      externalEmployeeId: string;
      hasRealEmail: boolean;
    }
  | { ok: false; code: string; message: string };

/**
 * 이메일·직원 ID 중 하나 이상 필요.
 * 이메일이 있으면 직원 ID가 비어 있을 때 로컬파트(@ 앞)로 채움.
 * 이메일 없이 ID만 있으면 합성 이메일을 User.email에 저장.
 */
export function resolveEmployeeIdentity(input: {
  companyId: string;
  email?: string | null;
  externalEmployeeId?: string | null;
}): ResolvedEmployeeIdentity {
  const rawEmail = (input.email ?? "").trim().toLowerCase();
  const hasRealEmail = Boolean(rawEmail) && !isSyntheticEmployeeEmail(rawEmail);
  let externalEmployeeId =
    (input.externalEmployeeId ?? "").trim().slice(0, 80) || null;

  if (hasRealEmail && !externalEmployeeId) {
    const local = emailLocalPart(rawEmail);
    externalEmployeeId = local || null;
  }

  if (!hasRealEmail && !externalEmployeeId) {
    return {
      ok: false,
      code: "EMAIL_OR_ID_REQUIRED",
      message: "이메일 또는 직원 ID 중 하나는 필요합니다.",
    };
  }

  if (hasRealEmail) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(rawEmail)) {
      return {
        ok: false,
        code: "INVALID_EMAIL",
        message: "이메일 형식이 올바르지 않습니다.",
      };
    }
    return {
      ok: true,
      email: rawEmail,
      externalEmployeeId: externalEmployeeId!,
      hasRealEmail: true,
    };
  }

  return {
    ok: true,
    email: buildSyntheticEmployeeEmail(input.companyId, externalEmployeeId!),
    externalEmployeeId: externalEmployeeId!,
    hasRealEmail: false,
  };
}
