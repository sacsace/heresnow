import type { Locale } from "@/lib/i18n/dictionaries";
import webpush from "web-push";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

let configured = false;

function ensureWebPushConfigured(): boolean {
  if (configured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "mailto:support@heresnow.in";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  );
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ ok: true } | { ok: false; statusCode?: number; gone: boolean }> {
  if (!ensureWebPushConfigured()) {
    return { ok: false, gone: false };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 }
    );
    return { ok: true };
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode?: number }).statusCode)
        : undefined;
    const gone = statusCode === 404 || statusCode === 410;
    return { ok: false, statusCode, gone };
  }
}

export function checkInReminderCopy(
  kind: "BEFORE_15" | "AFTER_15",
  locale: Locale,
  workStartLabel: string
): PushPayload {
  if (locale === "en") {
    if (kind === "BEFORE_15") {
      return {
        title: "Check-in reminder",
        body: `Your shift starts at ${workStartLabel}. Tap to check in.`,
        url: "/employee",
        tag: "check-in-before-15",
      };
    }
    return {
      title: "Not checked in yet",
      body: `You haven't checked in yet (shift started at ${workStartLabel}). Tap to check in.`,
      url: "/employee",
      tag: "check-in-after-15",
    };
  }

  if (kind === "BEFORE_15") {
    return {
      title: "출근 알림",
      body: `정규 출근 ${workStartLabel} 15분 전입니다. 출근하기를 눌러 주세요.`,
      url: "/employee",
      tag: "check-in-before-15",
    };
  }
  return {
    title: "출근 확인",
    body: `아직 출근 기록이 없습니다 (정규 출근 ${workStartLabel}). 출근하기를 눌러 주세요.`,
    url: "/employee",
    tag: "check-in-after-15",
  };
}
