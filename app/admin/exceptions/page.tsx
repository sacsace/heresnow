"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import {
  btnSecondary,
  btnSuccess,
  emptyState,
  groupedCard,
  groupedRow,
  hint,
  pageStack,
  sectionLabel,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

type Ex = {
  id: string;
  reason: string;
  status: string;
  attendance: {
    type: string;
    timestamp: string;
    employee: { name: string };
    site: { name: string } | null;
  };
};

export default function AdminExceptionsPage() {
  const [items, setItems] = useState<Ex[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/exceptions");
    const j = await r.json();
    if (r.ok) setItems(j.exceptions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, action: "approve" | "reject") {
    const r = await fetch(`/api/admin/exceptions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (r.ok) await load();
  }

  return (
    <div className={pageStack}>
      <PageHeader title="예외 승인" subtitle="반경 외·기타 예외 출퇴근 요청을 검토합니다." />

      {loading ? (
        <p className="text-[1rem] text-[var(--apple-label-secondary)]">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className={emptyState}>대기 중인 예외가 없습니다.</p>
      ) : (
        <section>
          <p className={sectionLabel}>대기 목록</p>
          <ul className={groupedCard}>
            {items.map((x, i) => (
              <li
                key={x.id}
                className={`${groupedRow} ${i < items.length - 1 ? "border-b border-[var(--separator)]" : ""}`}
              >
                <p className="font-semibold text-[var(--foreground)]">
                  {x.attendance.employee.name} · {x.attendance.type}
                  {x.attendance.site?.name ? ` · ${x.attendance.site.name}` : ""}
                </p>
                <p className={`mt-1 ${hint}`}>
                  {new Date(x.attendance.timestamp).toLocaleString("ko-KR")}
                </p>
                <p className="mt-2 text-[0.9375rem] text-[var(--foreground)]">사유: {x.reason}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={btnSuccess}
                    onClick={() => void resolve(x.id, "approve")}
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => void resolve(x.id, "reject")}
                  >
                    반려
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
