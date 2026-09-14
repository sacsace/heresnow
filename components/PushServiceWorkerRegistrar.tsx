"use client";

import { registerPushServiceWorker } from "@/lib/pushClient";
import { useEffect } from "react";

/** PWA·Web Push용 service worker 등록 (권한 요청은 별도 UI) */
export function PushServiceWorkerRegistrar() {
  useEffect(() => {
    void registerPushServiceWorker();
  }, []);

  return null;
}
