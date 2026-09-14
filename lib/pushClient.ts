import type { Locale } from "@/lib/i18n/dictionaries";

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function getPushRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return registerPushServiceWorker();
}

export type PushSubscriptionJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function bufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function subscriptionToJson(sub: PushSubscription): PushSubscriptionJson {
  const json = sub.toJSON();
  const keys = json.keys ?? {};
  return {
    endpoint: json.endpoint ?? sub.endpoint,
    keys: {
      p256dh: keys.p256dh ?? bufferToBase64Url(sub.getKey("p256dh")),
      auth: keys.auth ?? bufferToBase64Url(sub.getKey("auth")),
    },
  };
}

export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscription | null> {
  const registration = await getPushRegistration();
  if (!registration) return null;

  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await getPushRegistration();
  if (!registration) return false;
  const sub = await registration.pushManager.getSubscription();
  if (!sub) return true;
  return sub.unsubscribe();
}

export async function syncPushSubscriptionToServer(locale: Locale): Promise<{ ok: boolean; error?: string }> {
  const vapidRes = await fetch("/api/user/push-subscription");
  const vapidJson = (await vapidRes.json().catch(() => ({}))) as { vapidPublicKey?: string | null };
  const vapidPublicKey = vapidJson.vapidPublicKey;
  if (!vapidPublicKey) {
    return { ok: false, error: "NOT_CONFIGURED" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "PERMISSION_DENIED" };
  }

  const sub = await subscribeToPush(vapidPublicKey);
  if (!sub) {
    return { ok: false, error: "SUBSCRIBE_FAILED" };
  }

  const body = subscriptionToJson(sub);
  const res = await fetch("/api/user/push-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, locale }),
  });
  if (!res.ok) {
    return { ok: false, error: "SAVE_FAILED" };
  }
  return { ok: true };
}

export async function removePushSubscriptionFromServer(): Promise<boolean> {
  const registration = await getPushRegistration();
  const sub = registration ? await registration.pushManager.getSubscription() : null;
  const endpoint = sub?.endpoint;

  if (sub) {
    await sub.unsubscribe();
  }

  const res = await fetch("/api/user/push-subscription", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(endpoint ? { endpoint } : {}),
  });
  return res.ok;
}
