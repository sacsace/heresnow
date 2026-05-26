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
 * 로케일에 맞춰 표기되는 시·분 선택기.
 *
 * 일부 브라우저(특히 Windows Chrome)는 <input type="time"> 의 표기에
 * OS 로케일을 우선 적용해, 화면 언어가 영어여도 "오전 09:00"처럼 표시됨.
 * 이 컴포넌트는 셀렉트 박스로 직접 그려 화면 언어 100% 통제.
 *
 * - en: 12시간 표기 + AM/PM 셀렉트
 * - ko (그 외): 24시간 표기
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

  if (locale === "en") {
    const period: "AM" | "PM" = hh >= 12 ? "PM" : "AM";
    const hour12 = ((hh + 11) % 12) + 1;
    const hourOptions12 = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
      <div
        role="group"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        className={`${inputShellClass} ${className}`.trim()}
      >
        <select
          disabled={disabled}
          aria-label="Hour"
          value={hour12}
          onChange={(e) => {
            const h12 = Number(e.target.value);
            const next = period === "AM" ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12;
            setTime(next, mm);
          }}
          className={segmentClass}
        >
          {hourOptions12.map((h) => (
            <option key={h} value={h}>
              {pad2(h)}
            </option>
          ))}
        </select>
        <span aria-hidden>:</span>
        <select
          disabled={disabled}
          aria-label="Minute"
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
        <select
          disabled={disabled}
          aria-label="AM/PM"
          value={period}
          onChange={(e) => {
            const next = e.target.value as "AM" | "PM";
            const newHh = next === "AM" ? (hh >= 12 ? hh - 12 : hh) : hh < 12 ? hh + 12 : hh;
            setTime(newHh, mm);
          }}
          className={`${segmentClass} ml-1`}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    );
  }

  // ko / 기본: 24시간
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
        aria-label="시"
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
        aria-label="분"
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
