/** 데스크톱·일반 브라우저 로그인 유지 (초) */
export const SESSION_MAX_AGE_DEFAULT_SEC = 30 * 24 * 60 * 60;

/** 모바일·태블릿 로그인 유지 (초) — 출퇴근 앱처럼 재로그인 최소화 */
export const SESSION_MAX_AGE_MOBILE_SEC = 365 * 24 * 60 * 60;

/** 활동 시 세션 만료 연장 주기 (초) */
export const SESSION_UPDATE_AGE_SEC = 7 * 24 * 60 * 60;

export function parseStaySignedIn(value: unknown): boolean {
  return value === true || value === "1" || value === "true";
}

export function sessionMaxAgeSec(staySignedIn: boolean): number {
  return staySignedIn ? SESSION_MAX_AGE_MOBILE_SEC : SESSION_MAX_AGE_DEFAULT_SEC;
}

export function applySessionExpiry(
  token: { exp?: number; sessionMaxAge?: number },
  maxAgeSec: number
): void {
  token.sessionMaxAge = maxAgeSec;
  token.exp = Math.floor(Date.now() / 1000) + maxAgeSec;
}
