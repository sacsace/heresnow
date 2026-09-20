/** 자동 퇴근 기록 식별용 memo — UI 에서 "(자동 퇴근)" 표시 */
export const AUTO_CHECKOUT_MEMO = "[AUTO_CHECKOUT]";

export function isAutoCheckOutMemo(memo: string | null | undefined): boolean {
  if (!memo) return false;
  return memo.includes(AUTO_CHECKOUT_MEMO);
}

export function formatCheckOutDisplay(
  time: string,
  isAuto: boolean,
  t: (key: string) => string
): string {
  return isAuto ? `${time} ${t("employee.autoCheckOut")}` : time;
}
