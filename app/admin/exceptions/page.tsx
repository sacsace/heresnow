"use client";

import { useCallback, useEffect, useState } from "react";

type Ex = {
  id: string;
  reason: string;
  status: string;
  attendance: {
    type: string;
    timestamp: string;
    employee: { name: string };
    site: { name: string };
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
    <div>
      <h1 className="text-xl font-semibold text-slate-900">예외 승인 대기</h1>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">대기 중인 예외가 없습니다.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((x) => (
            <li key={x.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-slate-900">
                {x.attendance.employee.name} · {x.attendance.type} · {x.attendance.site.name}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(x.attendance.timestamp).toLocaleString("ko-KR")}
              </p>
              <p className="mt-2 text-sm text-slate-700">사유: {x.reason}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
                  onClick={() => void resolve(x.id, "approve")}
                >
                  승인
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
                  onClick={() => void resolve(x.id, "reject")}
                >
                  반려
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
