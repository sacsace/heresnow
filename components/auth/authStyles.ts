/** macOS-style auth typography — compact, separate from app page titles */
import {
  authCardShell,
  authColumn,
  authPageOuter,
  bannerSuccess,
  bannerWarning,
  errorText,
  hint,
  link,
  select,
  textarea,
} from "@/lib/uiStyles";

export const authPage = authPageOuter;
export const authColumnFixed = authColumn;
export const authCard = authCardShell;

/** 로그인 카드 — 기본 대비 세로 패딩 약 20% 증가 */
export const authCardLogin = `${authCardShell} py-7 sm:py-[2.125rem]`;

/** 가입 카드 — 폼 필드 많음, 로그인보다 넓고 여유 있게 */
export const authCardSignup = `${authCardShell} py-7 sm:py-8`;

/** AuthShell className — 가입 폼 고정 폭 */
export const authShellSignupWidth = "!w-[28rem] sm:!w-[32rem]";

/** @deprecated use authShellSignupWidth */
export const authColumnSignup = authShellSignupWidth;

/** 화면 맨 아래 중앙 (뷰포트 기준) */
export const authViewportFooter =
  "pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center pb-5 sm:pb-6";

/** 뷰포트 하단 저작권 문구 */
export const authCopyright =
  "text-center text-[0.75rem] text-[var(--apple-label-tertiary)] sm:text-[0.8125rem]";

export const authTitle =
  "text-center text-[1.25rem] font-semibold leading-tight tracking-tight text-[var(--foreground)]";

export const authSubtitle =
  "mx-auto mt-1.5 max-w-[18rem] text-center text-[0.75rem] leading-snug text-[var(--apple-label-secondary)] sm:text-[0.8125rem]";

/** 로그인 부제 — 영어 전환 시 줄바꿈 최소화 */
export const authSubtitleLogin =
  "mx-auto mt-1.5 w-full whitespace-pre-line text-center text-[0.75rem] leading-snug text-[var(--apple-label-secondary)] sm:text-[0.8125rem]";

/** 가입 부제 — 카드 폭에 맞춤 */
export const authSubtitleSignup =
  "mx-auto mt-1.5 w-full max-w-none text-center text-[0.75rem] leading-snug text-[var(--apple-label-secondary)] sm:text-[0.8125rem]";

export const authForm = "mt-5 space-y-4";

export const authFormSignup = "mt-6 space-y-[1.125rem]";

/** 로그인 폼 — 카드 세로 확대에 맞춘 간격 */
export const authFormLogin = "mt-6 space-y-[1.125rem]";
export const authFieldGroup = "space-y-1.5";

export const authLabel =
  "block text-[0.75rem] font-medium text-[var(--apple-label-secondary)] sm:text-[0.8125rem]";

export const authInput =
  "w-full rounded-[0.625rem] border-0 bg-[var(--fill-secondary)] px-3.5 py-2 text-[0.875rem] text-[var(--foreground)] outline-none transition-[box-shadow,background-color] placeholder:text-[var(--apple-label-tertiary)] focus:bg-[var(--fill-secondary-hover)] focus:ring-2 focus:ring-[var(--apple-blue)]/25 sm:text-[0.9375rem]";

export const authSelect = `${select} py-2 text-[0.875rem] sm:text-[0.9375rem]`;
export const authTextarea = `${textarea} min-h-[4.5rem] py-2 text-[0.875rem] sm:text-[0.9375rem]`;
export const authHint = `${hint} text-[0.75rem] sm:text-[0.8125rem]`;

export const authError = `${errorText} text-center text-[0.8125rem]`;

export const authButtonPrimary =
  "touch-manipulation w-full rounded-[0.625rem] bg-[var(--apple-blue)] py-2 text-[0.875rem] font-semibold text-white transition-colors hover:bg-[#0071e3] active:bg-[#0066cc] disabled:opacity-40 sm:text-[0.9375rem]";

export const authFooter =
  "mt-5 text-center text-[0.75rem] text-[var(--apple-label-secondary)] sm:text-[0.8125rem]";

export const authLink = `${link} text-[0.8125rem] font-medium`;

export const authBannerSuccess = `${bannerSuccess} text-[0.8125rem]`;
export const authBannerWarning = `${bannerWarning} text-[0.75rem]`;

export const authLangSlot = "fixed right-4 top-4 z-50 sm:right-6 sm:top-5";
