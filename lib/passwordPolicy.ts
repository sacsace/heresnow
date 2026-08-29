/** 기존 계정 호환을 위한 로그인 최소 길이 */
export const MIN_PASSWORD_LENGTH = 6;

/** 신규/변경 비밀번호 보안 정책 */
export const STRONG_PASSWORD_MIN_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

const PASSWORD_LOWER_RE = /[a-z]/;
const PASSWORD_UPPER_RE = /[A-Z]/;
const PASSWORD_NUMBER_RE = /[0-9]/;
const PASSWORD_SPECIAL_RE = /[^A-Za-z0-9]/;

/**
 * 서버 기준 강한 비밀번호 정책:
 * - 최소 8자
 * - 영문 대문자/소문자/숫자/특수문자 각각 1자 이상
 */
export function isStrongPassword(password: string): boolean {
  if (password.length < STRONG_PASSWORD_MIN_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  return (
    PASSWORD_LOWER_RE.test(password) &&
    PASSWORD_UPPER_RE.test(password) &&
    PASSWORD_NUMBER_RE.test(password) &&
    PASSWORD_SPECIAL_RE.test(password)
  );
}
