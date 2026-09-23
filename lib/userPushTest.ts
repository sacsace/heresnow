import type { Locale } from "@/lib/i18n/dictionaries";
import { sendPushToUser } from "@/lib/pushNotify";
import { isWebPushConfigured } from "@/lib/webPush";

export type UserPushTestResult =
  | { ok: true; sent: number }
  | { ok: false; error: "NOT_CONFIGURED" | "NO_SUBSCRIPTION" | "DELIVERY_FAILED" };

/** 내 계정 — 즉시 테스트 Web Push 1건 (등록된 모든 기기) */
export async function sendUserPushTest(userId: string): Promise<UserPushTestResult> {
  if (!isWebPushConfigured()) {
    return { ok: false, error: "NOT_CONFIGURED" };
  }

  const sent = await sendPushToUser(userId, (locale: Locale) =>
    locale === "en"
      ? {
          title: "HeresNow test",
          body: "If you see this, push notifications are working on this device.",
          url: "/account",
          tag: "user-push-test",
        }
      : {
          title: "HeresNow 테스트",
          body: "이 알림이 보이면 이 기기에서 푸시가 정상 동작하는 것입니다.",
          url: "/account",
          tag: "user-push-test",
        }
  );

  if (sent <= 0) {
    return { ok: false, error: "NO_SUBSCRIPTION" };
  }

  return { ok: true, sent };
}
