/**
 * Apple HIG–inspired design tokens (Tailwind class strings).
 * Auth pages import from authStyles; app surfaces use these.
 */

export const pageBg = "min-h-dvh bg-[var(--background)] text-[var(--foreground)]";

/** App chrome — header / body / footer column */
export const appShell =
  "flex min-h-dvh flex-col bg-[var(--background)] text-[var(--foreground)]";

export const appBody = "flex w-full min-w-0 flex-1 flex-col items-center";

/** Shared content column — viewport width minus 8rem left/right (see globals.css) */
export const appBodyWidth = "app-content-width";

export const appFooter =
  "shrink-0 bg-[var(--bar-bg)] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-8 lg:px-10";

export const appFooterText =
  "text-center text-[0.75rem] text-[var(--apple-label-tertiary)] sm:text-[0.8125rem]";

export const appContainer = "px-5 py-8 sm:px-8 sm:py-10 lg:px-10";
export const appContainerAdmin =
  "px-5 pb-8 pt-5 sm:px-8 sm:pb-10 sm:pt-6 lg:px-10";
/** Super/admin 본문 — 네비 직후 콘텐츠 시작 (상단 패딩 축소) */
export const appContainerSuper =
  "px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 lg:px-8";
export const appContainerEmployee = appContainer;

/** Sticky frosted navigation bar */
export const navBar =
  "sticky top-0 z-40 border-b border-[var(--separator)] bg-[var(--bar-bg)] backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--bar-bg)]";

export const navBarInner =
  "mx-auto flex max-w-[86.4rem] min-w-0 flex-nowrap items-center justify-between gap-2 px-4 py-3 sm:gap-6 sm:px-8 sm:py-4 lg:px-10";

export const navBarInnerSuper =
  "app-content-width flex min-w-0 flex-nowrap items-center justify-between gap-2 px-4 py-3 sm:gap-6 sm:px-8 sm:py-4 lg:px-10";

export const navBarInnerEmployee =
  "mx-auto flex max-w-[86.4rem] min-w-0 flex-nowrap items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-8 sm:py-4 lg:px-10";

/** Segmented nav track (admin header) */
export const navSegmentedWrap =
  "inline-flex h-9 min-w-0 max-w-full overflow-x-auto rounded-[0.625rem] bg-[var(--fill-secondary)] p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export const navSegmentedBtn = (active: boolean) =>
  `inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-[0.4375rem] px-2.5 text-[0.75rem] font-semibold transition-colors sm:px-3 sm:text-[0.8125rem] ${
    active
      ? "bg-white text-[var(--foreground)] shadow-sm"
      : "text-[var(--apple-label-secondary)] hover:text-[var(--foreground)]"
  }`;

export const navBrand =
  "shrink-0 text-[0.9375rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-[1rem]";

/** Circular logo frame — header / auth */
export const logoCircle =
  "relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/[0.06] sm:h-10 sm:w-10";
export const logoCircleAuth =
  "relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-black/[0.06] sm:h-12 sm:w-12";

export const logoTitle = `${navBrand} truncate leading-none`;
export const logoTitleAuth =
  "text-[1.125rem] font-semibold tracking-tight text-[var(--foreground)] sm:text-[1.25rem]";

export const navLinksRow = "flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2";

/** Nav pill — uniform tap target (matches header controls h-9) */
const navLinkBase =
  "inline-flex h-9 min-w-[4.5rem] shrink-0 items-center justify-center whitespace-nowrap rounded-[0.625rem] px-3 text-center text-[0.8125rem] transition-colors sm:min-w-[5.75rem] sm:px-3.5 sm:text-[0.875rem]";

export const navLink =
  `${navLinkBase} font-medium text-[var(--apple-label-secondary)] hover:bg-[var(--fill-tertiary)] hover:text-[var(--foreground)]`;

export const navLinkActive =
  `${navLinkBase} bg-[var(--fill-tertiary)] font-semibold text-[var(--foreground)]`;

/** Super nav — equal-width items on wider screens */
export const navLinkEqual = "flex-1 basis-0 sm:flex-none";

/** Super nav — wide enough for "Upgrade requests" */
export const navLinkSuperMin = "sm:!min-w-[7.25rem]";

/** Header right cluster */
export const headerActions =
  "flex shrink-0 flex-nowrap items-center justify-end gap-1.5 sm:gap-4";

export const headerDivider = "hidden h-9 w-px shrink-0 bg-[var(--separator)] sm:block";

export const headerUserPanel =
  "flex min-w-0 max-w-[9rem] flex-col text-right sm:max-w-[14rem] md:max-w-[18rem]";

export const headerUserEmail =
  "truncate text-[0.75rem] font-medium leading-tight text-[var(--foreground)] sm:text-[0.8125rem]";

export const headerUserRole =
  "mt-0.5 truncate text-[0.6875rem] leading-tight text-[var(--apple-label-secondary)] sm:text-[0.75rem]";

/** Large navigation title (macOS Settings–style) */
export const pageTitle =
  "text-[1.25rem] font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-[1.375rem]";
export const pageSubtitle =
  "mt-1.5 max-w-3xl text-[0.8125rem] leading-snug text-[var(--apple-label-secondary)] sm:text-[0.875rem]";

/** Section label above grouped content */
export const sectionLabel =
  "mb-3 px-1 text-[0.8125rem] font-semibold uppercase tracking-[0.04em] text-[var(--apple-label-secondary)] sm:text-[0.875rem]";
export const sectionLabelCompact =
  "mb-2 px-1 text-[0.75rem] font-semibold tracking-[0.01em] text-[var(--apple-label-secondary)] sm:text-[0.8125rem]";

/** Grouped inset list container (Settings-style) */
export const groupedCard =
  "overflow-hidden rounded-2xl bg-[var(--grouped-bg)] shadow-sm ring-1 ring-black/[0.04]";

export const groupedRow = "px-5 py-3.5 text-[0.9375rem] leading-snug text-[var(--foreground)] sm:px-6 sm:py-4";

export const groupedRowDivider = "border-b border-[var(--separator)] last:border-b-0";

export const groupedRowInsetDivider =
  "border-b border-[var(--separator)] last:border-b-0 ml-4 sm:ml-5";

/** Standalone content card with optional header/footer dividers */
export const card = groupedCard;
export const cardHeader = "border-b border-[var(--separator)] px-5 py-4 sm:px-6";
export const cardBody = "px-5 py-5 sm:px-6 sm:py-6";
export const cardBodyCompact = "px-3.5 py-3 sm:px-4 sm:py-3.5";
export const cardFooter = "border-t border-[var(--separator)] px-5 py-4 sm:px-6";

export const hairline = "border-[var(--separator)]";

/** Form controls */
export const label =
  "block text-[0.8125rem] font-medium leading-snug text-[var(--apple-label-secondary)]";

export const input =
  "w-full rounded-[0.625rem] border-0 bg-[var(--fill-secondary)] px-3.5 py-2.5 text-[0.9375rem] text-[var(--foreground)] outline-none transition-[box-shadow,background-color] placeholder:text-[var(--apple-label-tertiary)] focus:bg-[var(--fill-secondary-hover)] focus:ring-2 focus:ring-[var(--apple-blue)]/25";

export const inputSm = `${input} px-3.5 py-2.5 text-[0.9375rem]`;

export const select =
  "auth-select-field w-full rounded-[0.625rem] border-0 px-3.5 py-2.5 pr-10 text-[0.9375rem] text-[var(--foreground)] outline-none transition-[box-shadow,background-color] focus:ring-2 focus:ring-[var(--apple-blue)]/25";

export const selectSm = `${select} w-auto min-w-[8rem] py-2.5 text-[0.9375rem] sm:min-w-[9rem]`;

export const textarea = `${input} min-h-[5.5rem] resize-y`;

export const hint = "text-[0.875rem] leading-relaxed text-[var(--apple-label-tertiary)] sm:text-[0.9375rem]";

export const caption = "text-[0.75rem] leading-snug text-[var(--apple-label-tertiary)] sm:text-[0.8125rem]";

export const toolbar = "flex flex-wrap items-center gap-3";

export const errorText = "text-[0.9375rem] leading-snug text-[var(--apple-red)]";

export const successText = "text-[0.9375rem] leading-snug text-[var(--apple-green)]";

export const bannerSuccess =
  "rounded-[0.625rem] bg-[var(--apple-green)]/10 px-3.5 py-3 text-[0.9375rem] leading-snug text-[var(--apple-green-dark)]";

export const bannerWarning =
  "rounded-[0.625rem] bg-[var(--apple-orange)]/10 px-3.5 py-3 text-[0.8125rem] leading-relaxed text-[var(--apple-orange-dark)]";

export const bannerInfo = "rounded-[0.625rem] bg-[var(--apple-blue)]/10 px-3.5 py-3 text-[0.9375rem] text-[var(--apple-blue)]";

/** Buttons */
export const btnPrimary =
  "inline-flex min-h-[2.25rem] touch-manipulation items-center justify-center rounded-[0.625rem] bg-[var(--apple-blue)] px-5 py-2.5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#0071e3] active:bg-[#0066cc] disabled:opacity-40";

export const btnPrimaryFull = `w-full ${btnPrimary} py-2.5`;

export const btnSecondary =
  "inline-flex h-9 min-h-[2.25rem] touch-manipulation items-center justify-center rounded-[0.625rem] bg-[var(--fill-secondary)] px-4 text-[0.8125rem] font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--fill-secondary-hover)] active:opacity-80 disabled:opacity-40 sm:text-[0.875rem]";

export const btnDestructive =
  "text-[0.8125rem] font-medium text-[var(--apple-red)] hover:underline";

export const btnDanger =
  "inline-flex h-9 touch-manipulation items-center justify-center rounded-lg bg-[var(--apple-red)]/10 px-3.5 text-[0.8125rem] font-medium text-[var(--apple-red)] transition-colors hover:bg-[var(--apple-red)]/16 disabled:opacity-40";

export const btnGhost =
  "inline-flex h-9 touch-manipulation items-center justify-center rounded-lg px-3 text-[0.8125rem] font-medium text-[var(--apple-blue)] transition-colors hover:bg-[var(--fill-tertiary)]";

/** Inline action cluster (table row / card footer) */
export const actionBar = "flex flex-wrap items-center gap-1.5 sm:gap-2";

/** Body layout — sections, forms, cards */
export const bodySection = "space-y-3";

export const formInlineRow = "flex flex-col gap-3 sm:flex-row sm:items-end";

export const formField = "min-w-0 flex-1";

/** Compact panel — shrink to form/content width */
export const bodyPanelCompact = "w-fit max-w-full";

export const formFieldName = "w-full sm:w-[15rem] md:w-[18rem]";

export const formInlineRowCompact = "flex w-fit max-w-full flex-col gap-3 sm:flex-row sm:items-end";

export const searchToolbar = "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between";

export const searchFieldWrap = "min-w-0 w-full sm:max-w-sm";

/**
 * 가로형 검색/필터 행 — 필드들은 같은 baseline (items-end) 으로 정렬되고
 * 좁은 화면에서는 자동으로 줄바꿈된다. `searchActions` 와 함께 사용해
 * 액션 버튼을 자연스럽게 오른쪽으로 밀어낸다.
 */
export const searchFiltersRow = "flex flex-wrap items-end gap-x-3 gap-y-3";

/** 필드 셀 — 라벨 + 입력 한 묶음. 좁은 화면에서 자체 폭을 가짐. */
export const searchFieldCol = "flex min-w-0 flex-col gap-1.5";

/** 액션 버튼 클러스터 — 자동으로 우측 정렬 */
export const searchActions = "ml-auto flex flex-wrap items-end gap-2 pt-1.5 sm:pt-0";

export const filterCheckboxLabel =
  "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-[0.8125rem] font-medium text-[var(--apple-label-secondary)]";

export const cardSplitHeader = "flex flex-wrap items-start justify-between gap-3 sm:items-center sm:gap-4";

export const cardFieldGrid =
  "mt-4 grid gap-4 border-t border-[var(--separator)] pt-4 sm:grid-cols-2 sm:gap-5";

export const hintBox =
  "rounded-lg bg-[var(--fill-tertiary)] px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]";

export const hintBoxFit = `${hintBox} w-fit max-w-prose`;

export const cardActionBar = actionBar;

/** Compact numeric/date field in dense layouts */
export const inputCompact = `${input} !py-1.5 text-[0.875rem]`;

/** Table cell number input — fixed width (overrides input w-full) */
export const inputNumberCell = `${inputCompact} !w-[6rem] min-w-[6rem] max-w-[6rem] shrink-0 tabular-nums`;

export const inputTableLabel = `${inputCompact} !w-full min-w-0`;

export const inputTableNum = `${inputCompact} !w-[4.25rem] min-w-[4.25rem] max-w-[4.25rem] shrink-0 text-center tabular-nums`;

export const inputTablePrice = `${inputCompact} !w-[5.25rem] min-w-[5.25rem] max-w-[5.25rem] shrink-0 text-right tabular-nums`;

export const tableFooterBar =
  "flex flex-wrap items-center gap-2 border-t border-[var(--separator)] px-5 py-3.5 sm:px-6 sm:py-4";

/** Search/filter strip above a table (inside tableWrap) */
export const tableToolbar =
  "border-b border-[var(--separator)] px-5 py-3.5 sm:px-6 sm:py-4";

/** Compact icon control (month picker, toolbar) */
export const btnIcon =
  "touch-manipulation inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--fill-secondary)] text-[1.125rem] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--fill-secondary-hover)] active:opacity-80";

/** Toggle chip (weekday, filter) */
export const chipBtn = (active: boolean) =>
  `min-w-[2.5rem] touch-manipulation rounded-xl px-3.5 py-2 text-[0.9375rem] font-semibold transition-colors disabled:opacity-40 ${
    active
      ? "bg-[var(--apple-blue)] text-white shadow-sm"
      : "bg-[var(--fill-secondary)] text-[var(--apple-label-secondary)] hover:bg-[var(--fill-secondary-hover)] hover:text-[var(--foreground)]"
  }`;

/** Map / media surface */
export const mapSurface =
  "overflow-hidden rounded-2xl bg-[var(--fill-tertiary)] ring-1 ring-black/[0.04]";

export const link = "font-semibold text-[var(--apple-blue)] hover:text-[#0071e3] active:text-[#0066cc]";

/** Segmented control (period / billing) */
export const segmentedWrap = "inline-flex gap-1 rounded-xl bg-[var(--fill-secondary)] p-1";

export const segmentedBtn = (active: boolean) =>
  `min-w-[4.5rem] shrink-0 rounded-[0.5rem] px-3 py-2 text-[0.8125rem] font-semibold transition-colors sm:min-w-[5.5rem] sm:text-[0.875rem] ${
    active
      ? "bg-white text-[var(--foreground)] shadow-sm"
      : "text-[var(--apple-label-secondary)] hover:text-[var(--foreground)]"
  }`;

/** Language toggle (app header — compact, h-9 to match sign-out) */
export const langSegmentedWrap =
  "inline-flex h-9 shrink-0 overflow-hidden rounded-[0.625rem] bg-[var(--fill-secondary)] p-0.5";

export const langSegmentedBtn = (active: boolean) =>
  `flex h-8 min-w-[2.25rem] shrink-0 items-center justify-center whitespace-nowrap rounded-[0.4375rem] px-2 text-[0.75rem] font-semibold transition-colors sm:min-w-[4rem] sm:px-2.5 sm:text-[0.8125rem] ${
    active
      ? "bg-white text-[var(--foreground)]"
      : "text-[var(--apple-label-secondary)] hover:text-[var(--foreground)]"
  }`;

/** Language toggle (auth pages — top-right, slightly larger than app header) */
export const authLangSegmentedWrap =
  "inline-flex shrink-0 overflow-hidden rounded-xl bg-[var(--grouped-bg)] p-1.5 shadow-sm ring-1 ring-black/[0.06]";

export const authLangSegmentedBtn = (active: boolean) =>
  `min-w-[4.25rem] shrink-0 whitespace-nowrap rounded-[0.375rem] px-3.5 py-2 text-[0.8125rem] font-semibold transition-colors sm:min-w-[5.25rem] sm:px-4 sm:py-2.5 sm:text-[0.875rem] ${
    active
      ? "bg-[var(--fill-secondary)] text-[var(--foreground)]"
      : "text-[var(--apple-label-secondary)] hover:bg-[var(--fill-tertiary)] hover:text-[var(--foreground)]"
  }`;

/** Data table inside grouped card */
export const tableWrap = `${groupedCard} overflow-x-auto`;
export const table = "min-w-full text-left text-[0.9375rem] sm:text-[1rem]";
export const tableHead =
  "border-b border-[var(--separator)] bg-[var(--fill-tertiary)] text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--apple-label-secondary)] sm:text-[0.75rem]";
export const th = "px-5 py-2.5 whitespace-nowrap sm:px-6";
export const td = "px-5 py-3 align-middle text-[var(--foreground)] sm:px-6";
export const trDivider = "border-t border-[var(--separator)]";
export const tableRow = `${trDivider} transition-colors hover:bg-[var(--fill-tertiary)]/45`;

/** Editable pricing tier table */
export const tablePricing = `${table} table-fixed w-full max-w-[52rem]`;

export const tdEmail =
  `${td} font-mono text-[0.8125rem] tracking-tight text-[var(--apple-label-secondary)] sm:text-[0.875rem]`;
export const tdName = `${td} text-[0.875rem] font-semibold sm:text-[0.9375rem]`;
export const tdStatus = `${td} whitespace-nowrap`;

/** List rows with dividers */
export const listRow = `${groupedRow} ${groupedRowDivider}`;
export const listRowLink = `${listRow} block font-medium text-[var(--apple-blue)] hover:bg-[var(--fill-tertiary)]`;

export const emptyState = "px-5 py-10 text-center text-[0.875rem] text-[var(--apple-label-tertiary)]";

export const emptyStateCompact = "px-5 py-6 text-center text-[0.8125rem] text-[var(--apple-label-tertiary)]";

/** Vertical rhythm between major page blocks */
export const pageStack = "space-y-8 sm:space-y-10";

/** 상세·폼 페이지 (헤더–본문 간격 축소) */
export const pageStackDetail = "space-y-6 sm:space-y-8";

/** 2열 폼 그리드 (카드 내부) */
export const formGrid = "grid grid-cols-1 gap-4 sm:grid-cols-2";

export const formGridFull = "sm:col-span-2";

/** Comfortable detail-page scale — larger cards, inputs, tables */
export const pageTitleLg =
  "text-[1.375rem] font-semibold leading-tight tracking-tight text-[var(--foreground)] sm:text-[1.5rem] lg:text-[1.625rem]";
export const pageSubtitleLg =
  "mt-2 max-w-4xl text-[0.9375rem] leading-relaxed text-[var(--apple-label-secondary)] sm:text-[1rem]";
export const pageMetaLg =
  "text-[0.875rem] leading-snug text-[var(--apple-label-secondary)] sm:text-[0.9375rem]";

/**
 * Apple HIG: 그룹 라벨은 대문자가 아닌 sentence case, 약한 색조.
 * iOS 설정·연락처 앱의 섹션 헤더와 동일한 톤.
 */
export const sectionLabelLg =
  "mb-3 px-1 text-[0.8125rem] font-medium tracking-[0.005em] text-[var(--apple-label-secondary)] sm:text-[0.875rem]";

/**
 * Apple HIG 카드: 과한 그림자/대형 라운드 대신 hairline ring + 적당한 라운드.
 * iCloud 웹·App Store Connect의 폼 카드 톤을 차용.
 */
export const groupedCardLg =
  "overflow-hidden rounded-2xl bg-[var(--grouped-bg)] ring-1 ring-black/[0.05]";
/** 카드 본문 패딩: Apple 폼 카드는 24~28px 안쪽 여백을 가짐. 과거 32~40px → 축소. */
export const cardBodyLg = "px-5 py-5 sm:px-6 sm:py-6";

/** 라벨: 작고 가벼운 caption 톤. */
export const labelLg =
  "block text-[0.8125rem] font-medium tracking-[0.005em] text-[var(--apple-label-secondary)] sm:text-[0.875rem]";

/**
 * 입력 필드: 두꺼운 알약 대신 Apple 폼 표준에 가까운 36~40px 높이.
 * 라운드 0.625rem, 글자 15~16px, 클릭/포커스 시 미세 ring으로 활성 표시.
 */
export const inputLg =
  "w-full min-h-[2.25rem] rounded-[0.625rem] border-0 bg-[var(--fill-secondary)] px-3 py-2 text-[0.9375rem] text-[var(--foreground)] outline-none transition-[box-shadow,background-color] placeholder:text-[var(--apple-label-tertiary)] focus:bg-[var(--fill-secondary-hover)] focus:ring-2 focus:ring-[var(--apple-blue)]/25 sm:min-h-[2.5rem] sm:text-[1rem]";

/**
 * 인라인 편집용 "고스트" 입력. 평소엔 셀과 구분이 거의 없고 포커스/호버 시에만
 * 미세한 fill로 입력 가능 영역을 시사 — Apple Settings·연락처의 인라인 편집 룩.
 */
export const inputTableLabelLg =
  "w-full min-w-0 rounded-md border-0 bg-transparent px-2 py-1.5 text-[0.9375rem] font-medium text-[var(--foreground)] outline-none transition-[background-color,box-shadow] hover:bg-[var(--fill-secondary)]/70 focus:bg-[var(--fill-secondary)] focus:ring-2 focus:ring-[var(--apple-blue)]/25 disabled:opacity-60 sm:text-[1rem]";

/** Select: input과 동일한 높이/라운드. */
export const selectLg =
  "auth-select-field w-full min-h-[2.25rem] rounded-[0.625rem] border-0 px-3 py-2 pr-9 text-[0.9375rem] text-[var(--foreground)] outline-none transition-[box-shadow,background-color] focus:ring-2 focus:ring-[var(--apple-blue)]/25 sm:min-h-[2.5rem] sm:text-[1rem]";

/** 기본 버튼: 입력 리듬에 맞춘 36~40px 높이. */
export const btnPrimaryLg =
  "inline-flex min-h-[2.25rem] touch-manipulation items-center justify-center rounded-[0.625rem] bg-[var(--apple-blue)] px-5 py-2 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#0071e3] active:bg-[#0066cc] disabled:opacity-40 sm:min-h-[2.5rem] sm:px-6 sm:text-[1rem]";

/** 폼 그리드 간격 축소. */
export const formGridLg = "grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2";
export const pageStackDetailLg = "space-y-6 sm:space-y-8";

export const tableWrapLg = `${groupedCardLg} overflow-x-auto`;
export const tableLg = "min-w-full text-left text-[0.9375rem] sm:text-[1rem]";
/**
 * Apple HIG: list headers are sentence case (not all-caps), low-contrast.
 * 헤더는 구분선 하나만으로 본문과 분리, 톤 다운된 라벨 색.
 */
export const tableHeadLg =
  "border-b border-[var(--separator)] text-[0.75rem] font-medium tracking-[0.005em] text-[var(--apple-label-secondary)] sm:text-[0.8125rem]";
export const thLg =
  "px-5 py-3 whitespace-nowrap font-medium text-[var(--apple-label-secondary)] sm:px-6";
/** 행 높이: 56→44pt (Apple Settings.app 행 높이 가이드). py-3에 align-middle. */
export const tdLg = "px-5 py-3 align-middle text-[var(--foreground)] sm:px-6 sm:py-3.5";
export const tdEmailLg =
  `${tdLg} font-mono text-[0.8125rem] tracking-tight text-[var(--apple-label-secondary)] sm:text-[0.875rem]`;
export const tdNameLg = `${tdLg} text-[0.9375rem] font-medium sm:text-[1rem]`;
export const tdStatusLg = `${tdLg} whitespace-nowrap`;
export const emptyStateLg =
  "px-5 py-10 text-center text-[0.875rem] text-[var(--apple-label-tertiary)] sm:px-6 sm:text-[0.9375rem]";

/** 상세·슈퍼 사용자 목록 등 — 행 간격 압축 */
export const tableLgCompact = "min-w-full text-left text-[0.875rem] sm:text-[0.9375rem]";
export const thCompactLg =
  "px-5 py-2 whitespace-nowrap font-medium text-[var(--apple-label-secondary)] sm:px-6";
export const tdCompactLg =
  "px-5 py-1.5 align-middle text-[var(--foreground)] sm:px-6 sm:py-2";
export const tdEmailCompactLg =
  `${tdCompactLg} font-mono text-[0.8125rem] tracking-tight text-[var(--apple-label-secondary)] sm:text-[0.875rem]`;
export const tdNameCompactLg = `${tdCompactLg} text-[0.875rem] font-medium sm:text-[0.9375rem]`;
export const tdStatusCompactLg = `${tdCompactLg} whitespace-nowrap`;
export const inputTableLabelCompactLg =
  "w-full min-w-0 rounded-md border-0 bg-transparent px-2 py-1 text-[0.875rem] font-medium text-[var(--foreground)] outline-none transition-[background-color,box-shadow] hover:bg-[var(--fill-secondary)]/70 focus:bg-[var(--fill-secondary)] focus:ring-2 focus:ring-[var(--apple-blue)]/25 disabled:opacity-60 sm:text-[0.9375rem]";
export const selectCompactLg =
  "auth-select-field w-full min-h-[2rem] rounded-[0.625rem] border-0 px-2.5 py-1 pr-8 text-[0.8125rem] text-[var(--foreground)] outline-none transition-[box-shadow,background-color] focus:ring-2 focus:ring-[var(--apple-blue)]/25 sm:text-[0.875rem]";

export const linkBackLg =
  "inline-flex min-h-[2.75rem] items-center text-[0.9375rem] font-semibold text-[var(--apple-blue)] hover:text-[#0071e3] sm:text-[1rem]";

export const pageMeta =
  "text-[0.8125rem] leading-snug text-[var(--apple-label-secondary)]";

export const linkBack =
  "inline-flex min-h-[2.25rem] items-center text-[0.8125rem] font-semibold text-[var(--apple-blue)] hover:text-[#0071e3]";

/** Keka-style metric tiles */
export const statGrid = "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4";

export const statCard =
  "rounded-2xl bg-[var(--grouped-bg)] px-5 py-4 shadow-sm ring-1 ring-black/[0.04] sm:px-6 sm:py-5";

export const statCardCompact =
  "min-w-0 rounded-xl bg-[var(--grouped-bg)] px-3 py-2.5 shadow-sm ring-1 ring-black/[0.04] sm:px-3.5 sm:py-3";

export const statValue =
  "text-[1.375rem] font-semibold tabular-nums tracking-tight text-[var(--foreground)] sm:text-[1.5rem]";

export const statLabel =
  "mt-1 text-[0.8125rem] font-medium text-[var(--apple-label-secondary)] sm:text-[0.875rem]";

/** Feature highlight pill (trust / product) */
export const featurePill =
  "inline-flex items-center gap-1 rounded-full bg-[var(--fill-secondary)] px-2.5 py-1 text-[0.6875rem] font-medium text-[var(--apple-label-secondary)] sm:text-[0.75rem]";

export const trustHero =
  "rounded-xl bg-[var(--fill-tertiary)] px-4 py-3.5 ring-1 ring-black/[0.04] sm:px-4 sm:py-4";

export const trustHeroTitle =
  "text-[0.875rem] font-semibold leading-snug tracking-tight text-[var(--foreground)]";

export const trustHeroLead =
  "mt-1 text-[0.75rem] leading-snug text-[var(--apple-label-secondary)] sm:text-[0.8125rem]";

export const btnSuccess =
  "touch-manipulation rounded-xl bg-[var(--apple-green)] px-5 py-2.5 text-[1rem] font-semibold text-white transition-colors hover:bg-[#30b350] active:bg-[#2da84a] disabled:opacity-40";

export const btnSuccessFull = `w-full ${btnSuccess} min-h-[2.75rem] py-2.5`;

/** Auth layout — fixed-width centered column (does not stretch with viewport) */
export const authPageOuter =
  "auth-surface relative flex min-h-dvh flex-col items-center justify-center px-5 py-8 sm:py-10";

/** Up to 352px / 384px — 좁은 모바일에서는 가용 폭에 맞춰 축소 */
export const authColumn =
  "flex w-full max-w-[22rem] shrink-0 flex-col sm:max-w-[24rem]";

export const authCardShell =
  "w-full shrink-0 overflow-hidden rounded-xl bg-[var(--grouped-bg)] px-5 py-6 shadow-sm ring-1 ring-black/[0.04] sm:px-6 sm:py-7";
