"use client";

import { useState, type ReactNode, type SyntheticEvent } from "react";

type Props = {
  title: string;
  /** 헤더 아래 짧은 설명(접힌 상태에서도 제목과 함께 보일 수 있음 — summary 안) */
  description?: string;
  /** 기본 펼침 */
  defaultOpen?: boolean;
  /** summary 오른쪽(저장 버튼 등) */
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
};

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 text-[var(--apple-label-tertiary)] transition-transform duration-200 group-open:rotate-180"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 설정 화면용 접이식 섹션.
 * details는 React에서 defaultOpen을 지원하지 않아 open 상태로 제어한다.
 */
export function SettingsDropdownSection({
  title,
  description,
  defaultOpen = false,
  headerRight,
  children,
  className = "",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  function onToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    setOpen(e.currentTarget.open);
  }

  return (
    <details
      className={`group overflow-hidden rounded-2xl border border-[var(--separator)] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
      open={open}
      onToggle={onToggle}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 bg-white px-5 py-4 marker:content-none sm:items-center sm:px-6 sm:py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-[1rem]">
            {title}
          </p>
          {description ? (
            <p className="mt-0.5 text-[0.8125rem] leading-snug text-[var(--apple-label-secondary)]">
              {description}
            </p>
          ) : null}
        </div>
        {headerRight ? (
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {headerRight}
          </div>
        ) : null}
        <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--fill-tertiary)] sm:mt-0">
          <Chevron />
        </span>
      </summary>
      {/* 외곽 테두리와 가로선이 겹치지 않도록 border-t 없이 간격만 둠 */}
      <div className="px-5 pb-4 pt-1 sm:px-6 sm:pb-5 sm:pt-1">{children}</div>
    </details>
  );
}

type NestedProps = {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** 회사 설정 카드 안쪽용 중첩 드롭다운 */
export function SettingsNestedDropdown({
  title,
  description,
  defaultOpen = false,
  children,
}: NestedProps) {
  const [open, setOpen] = useState(defaultOpen);

  function onToggle(e: SyntheticEvent<HTMLDetailsElement>) {
    setOpen(e.currentTarget.open);
  }

  return (
    <details
      className="group overflow-hidden rounded-xl border border-[var(--separator)] bg-white"
      open={open}
      onToggle={onToggle}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 border-b border-transparent px-3.5 py-3 marker:content-none group-open:border-[var(--separator)] sm:items-center sm:px-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold text-[var(--foreground)]">{title}</p>
          {description ? (
            <p className="mt-1 text-[0.8125rem] text-[var(--apple-label-secondary)]">{description}</p>
          ) : null}
        </div>
        <Chevron />
      </summary>
      <div className="p-3.5 sm:p-4">{children}</div>
    </details>
  );
}
