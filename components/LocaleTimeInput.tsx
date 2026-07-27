"use client";

import { useI18n } from "@/components/LanguageProvider";

type Props = {
  /** "HH:MM" (24-hour) — internal canonical form */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

/**
 * 시·분 선택기.
 *
 * 일부 브라우저(특히 Windows Chrome)는 <input type="time"> 표기에
 * OS 로케일을 우선 적용해 의도치 않은 포맷(예: AM/PM)이 보일 수 있다.
 * 이 컴포넌트는 셀렉트 박스로 직접 그려 항상 24시간(HH:mm) 표기를 유지한다.
 *
 * 외부와 주고받는 값은 항상 "HH:MM" 24시간 문자열.
 */
const inputShellClass =
  "flex w-full items-center gap-1.5 rounded-[0.625rem] border-0 bg-[var(--fill-secondary)] px-3 py-2 text-[0.9375rem] text-[var(--foreground)] outline-none transition-[box-shadow,background-color] focus-within:bg-[var(--fill-secondary-hover)] focus-within:ring-2 focus-within:ring-[var(--apple-blue)]/25 aria-disabled:cursor-not-allowed aria-disabled:opacity-60";

const segmentClass =
  "appearance-none cursor-pointer bg-transparent border-0 outline-none text-[var(--foreground)] tabular-nums focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export function LocaleTimeInput({
  value,
  onChange,
  disabled,
  className = "",
  ariaLabel,
}: Props) {
  const { locale } = useI18n();
  const [hhStr, mmStr] = (value || "00:00").split(":");
  const hh = clampInt(Number(hhStr), 0, 23);
  const mm = clampInt(Number(mmStr), 0, 59);

  const setTime = (newHh: number, newMm: number) => {
    const h = clampInt(newHh, 0, 23);
    const m = clampInt(newMm, 0, 59);
    onChange(`${pad2(h)}:${pad2(m)}`);
  };

  const minuteOptions = Array.from({ length: 60 }, (_, i) => i);
  const hourOptions24 = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={`${inputShellClass} ${className}`.trim()}
    >
      <select
        disabled={disabled}
        aria-label={locale === "en" ? "Hour" : "시"}
        value={hh}
        onChange={(e) => setTime(Number(e.target.value), mm)}
        className={segmentClass}
      >
        {hourOptions24.map((h) => (
          <option key={h} value={h}>
            {pad2(h)}
          </option>
        ))}
      </select>
      <span aria-hidden>:</span>
      <select
        disabled={disabled}
        aria-label={locale === "en" ? "Minute" : "분"}
        value={mm}
        onChange={(e) => setTime(hh, Number(e.target.value))}
        className={segmentClass}
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {pad2(m)}
          </option>
        ))}
      </select>
    </div>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  const x = Math.trunc(n);
  if (x < lo) return lo;
  if (x > hi) return hi;
  return x;
}
