/** 클라이언트(브라우저) 모바일·태블릿 추정 — SSR 시 false */
export function isMobileOrTabletClient(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const uaMobile =
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/.test(ua);
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const touchCapable = (window.navigator.maxTouchPoints ?? 0) > 0;
  return uaMobile || (coarsePointer && touchCapable);
}

/** NextAuth credentials — 모바일이면 장기 세션 요청 */
export function staySignedInCredentialValue(): "1" | "0" {
  return isMobileOrTabletClient() ? "1" : "0";
}
