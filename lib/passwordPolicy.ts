/** 로그인·신규·변경 공통 최소 길이 */
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 200;

export const WEAK_PASSWORD_MESSAGE = "비밀번호는 6자 이상 입력해 주세요.";

/** 비밀번호 정책: 6자 이상, 최대 200자 */
export function isStrongPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}
