import {
  pageMeta,
  pageMetaLg,
  pageSubtitle,
  pageSubtitleFull,
  pageSubtitleLg,
  pageTitle,
  pageTitleLg,
} from "@/lib/uiStyles";
import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  /** 부제를 body 가로 전체 너비로 표시 */
  subtitleWide?: boolean;
  /** 좌석·통계 등 부가 한 줄 */
  meta?: ReactNode;
  actions?: ReactNode;
  size?: "default" | "lg";
};

export function PageHeader({ title, subtitle, subtitleWide, meta, actions, size = "default" }: Props) {
  const lg = size === "lg";
  const titleClass = lg ? pageTitleLg : pageTitle;
  const subtitleClass = subtitleWide
    ? pageSubtitleFull
    : lg
      ? pageSubtitleLg
      : pageSubtitle;
  const metaClass = lg ? pageMetaLg : pageMeta;

  return (
    <header className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
      <div className="min-w-0 flex-1">
        <h1 className={titleClass}>{title}</h1>
        {subtitle && <p className={subtitleClass}>{subtitle}</p>}
        {meta && <p className={`${metaClass} ${subtitle ? "mt-1.5" : "mt-2"}`}>{meta}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 pt-0.5">{actions}</div>
      )}
    </header>
  );
}
