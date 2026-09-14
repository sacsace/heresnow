"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

const POLL_MS = 30_000;

/** 다른 기기 로그인으로 세션이 종료됐을 때 안내 후 로그인 화면으로 이동 */
export function SessionKickWatcher() {
  const { status } = useSession();
  const handlingRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      handlingRef.current = false;
      return;
    }

    let cancelled = false;

    async function checkSessionKick() {
      if (handlingRef.current || cancelled) return;
      try {
        const res = await fetch("/api/auth/session-kick", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as {
          reason?: string | null;
          active?: boolean;
        };
        if (cancelled || handlingRef.current) return;

        if (body.reason === "ANOTHER_DEVICE") {
          handlingRef.current = true;
          try {
            await signOut({ redirect: false });
          } catch {
            /* cookie 삭제 실패해도 로그인으로 이동 */
          }
          window.location.assign("/login?session=anotherDevice");
          return;
        }

        if (body.active === false) {
          handlingRef.current = true;
          try {
            await signOut({ redirect: false });
          } catch {
            /* ignore */
          }
          window.location.assign("/login?session=invalid");
        }
      } catch {
        /* 네트워크 오류 — 다음 주기에 재시도 */
      }
    }

    void checkSessionKick();
    const timer = window.setInterval(() => void checkSessionKick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [status]);

  return null;
}
