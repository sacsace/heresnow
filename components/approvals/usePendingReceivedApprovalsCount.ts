"use client";

import { PENDING_APPROVALS_CHANGED_EVENT } from "@/lib/pendingApprovalsEvents";
import { useCallback, useEffect, useState } from "react";

export function usePendingReceivedApprovalsCount() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch("/api/employee/pending-received-approvals-count");
    const j = (await r.json().catch(() => ({}))) as { count?: number };
    if (r.ok) setCount(typeof j.count === "number" ? j.count : 0);
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(PENDING_APPROVALS_CHANGED_EVENT, onChange);
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      window.removeEventListener(PENDING_APPROVALS_CHANGED_EVENT, onChange);
      window.clearInterval(interval);
    };
  }, [load]);

  return count;
}
