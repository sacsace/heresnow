"use client";

import { useCallback, useEffect, useState } from "react";

type Req = {
  id: string;
  amountDue: number;
  status: string;
  createdAt: string;
  note: string | null;
  company: { id: string; name: string; seatLimit: number };
  targetTier: { label: string | null; minSeats: number; maxSeats: number; pricePerYear: number };
};

export default function SuperBillingPage() {
  const [requests, setRequests] = useState<Req[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/super/billing-requests?status=PENDING");
    const j = await r.json();
    if (r.ok) setRequests(j.requests ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolve(id: string, status: "APPROVED" | "REJECTED") {
    if (!confirm(status === "APPROVED" ? "승인하고 회사 좌석·구독을 갱신할까요?" : "거절할까요?")) return;
    const r = await fetch(`/api/super/billing-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert(j.error ?? "처리 실패");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">요금 상향 요청</h1>
      <p className="text-sm text-zinc-500">회사가 납부 후 요청하면 승인 시 좌석 상한·구독 1년이 갱신됩니다.</p>
      <ul className="space-y-3">
        {requests.length === 0 && <li className="text-sm text-zinc-400">대기 중인 요청이 없습니다.</li>}
        {requests.map((q) => (
          <li key={q.id} className="rounded-xl border border-zinc-200/80 bg-white p-4 text-sm">
            <p className="font-medium text-zinc-900">{q.company.name}</p>
            <p className="mt-1 text-zinc-600">
              목표: {q.targetTier.label ?? `${q.targetTier.minSeats}–${q.targetTier.maxSeats}명`} · Rs.{q.amountDue} · 현재
              좌석 상한 {q.company.seatLimit}
            </p>
            {q.note && <p className="mt-1 text-zinc-500">메모: {q.note}</p>}
            <p className="mt-1 text-xs text-zinc-400">{new Date(q.createdAt).toLocaleString("ko-KR")}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
                onClick={() => void resolve(q.id, "APPROVED")}
              >
                승인
              </button>
              <button
                type="button"
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
                onClick={() => void resolve(q.id, "REJECTED")}
              >
                거절
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
