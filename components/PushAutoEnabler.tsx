"use client";

import { useI18n } from "@/components/LanguageProvider";
import { isPushSupported, syncPushSubscriptionToServer } from "@/lib/pushClient";
import { isStandaloneApp, needsIosHomeScreenForPush, PWA_INSTALLED_EVENT } from "@/lib/pwaPlatform";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
const SESSION_ATTEMPT_KEY = "heresnow_push_auto_attempted";

/**
 * PWA(홈 화면 앱) 설치·실행 시 Web Push 구독을 자동 등록한다.
 * iOS/Android 모두 브라우저 알림 권한 허용 팝업이 1회 표시될 수 있다.
 */
export function PushAutoEnabler() {
  const { data: session, status } = useSession();
  const { locale } = useI18n();
  const runningRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;

    async function tryAutoEnable() {
      if (runningRef.current) return;
      if (!isPushSupported()) return;
      if (needsIosHomeScreenForPush()) return;
      if (typeof Notification !== "undefined" && Notification.permission === "denied") return;
      if (sessionStorage.getItem(SESSION_ATTEMPT_KEY) === "1") return;

      runningRef.current = true;
      sessionStorage.setItem(SESSION_ATTEMPT_KEY, "1");

      try {
        const r = await fetch("/api/user/push-subscription");
        const j = (await r.json().catch(() => ({}))) as {
          configured?: boolean;
          subscribed?: boolean;
        };
        if (!j.configured || j.subscribed) return;

        await syncPushSubscriptionToServer(locale);
      } catch {
        /* ignore — 사용자는 내 계정에서 수동 설정 가능 */
      } finally {
        runningRef.current = false;
      }
    }

    if (isStandaloneApp()) {
      void tryAutoEnable();
    }

    function onInstalled() {
      void tryAutoEnable();
    }

    window.addEventListener(PWA_INSTALLED_EVENT, onInstalled);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener(PWA_INSTALLED_EVENT, onInstalled);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [status, session?.user?.id, locale]);

  return null;
}
