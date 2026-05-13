"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Tier = {
  id: string;
  minSeats: number;
  maxSeats: number;
  pricePerYear: number;
  currency: string;
  label: string | null;
};

type BillingState = {
  company: {
    name: string;
    seatLimit: number;
    subscriptionEndsAt: string | null;
    pricingTier: Tier | null;
  };
  employeeCount: number;
  upgradeTiers: Tier[];
  pendingRequest: { id: string; amountDue: number; targetTier: Tier; createdAt: string } | null;
};

export default function AdminBillingPage() {
  const { data: session } = useSession();
  const canRequestUpgrade =
    session?.user?.role === "COMPANY_ADMIN" || session?.user?.role === "HR_MANAGER";

  const [data, setData] = useState<BillingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/billing");
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "불러오기 실패");
      return;
    }
    setData(j as BillingState);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function requestUpgrade(tierId: string) {
    if (!confirm("상위 요금제로 변경을 요청합니다. 슈퍼관리자 승인 후 좌석이 늘어납니다. 계속할까요?")) return;
    setLoading(true);
    const r = await fetch("/api/admin/billing/request-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTierId: tierId, note: note.trim() || undefined }),
    });
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      alert(j.error ?? "요청 실패");
      return;
    }
    setNote("");
    await load();
    alert("요청이 등록되었습니다. 입금·승인은 슈퍼관리자와 조율하세요.");
  }

  if (error && !data) {
    return <p className="text-red-600">{error}</p>;
  }
  if (!data) {
    return <p className="text-zinc-600">불러오는 중…</p>;
  }

  const { company, employeeCount, upgradeTiers, pendingRequest } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">요금·좌석</h1>
      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-medium text-zinc-800">{company.name}</h2>
        <dl className="mt-4 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">현재 좌석 사용</dt>
            <dd className="font-semibold">
              {employeeCount} / {company.seatLimit}명
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">구독 만료</dt>
            <dd className="font-semibold">
              {company.subscriptionEndsAt
                ? new Date(company.subscriptionEndsAt).toLocaleDateString("ko-KR")
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">적용 요금제</dt>
            <dd>
              {company.pricingTier
                ? `${company.pricingTier.label ?? `${company.pricingTier.minSeats}–${company.pricingTier.maxSeats}명`} · Rs.${company.pricingTier.pricePerYear}/년`
                : "미지정"}
            </dd>
          </div>
        </dl>
      </section>

      {pendingRequest && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">승인 대기 중인 상향 요청</p>
          <p className="mt-1">
            목표:{" "}
            {pendingRequest.targetTier.label ??
              `${pendingRequest.targetTier.minSeats}–${pendingRequest.targetTier.maxSeats}명`}{" "}
            · Rs.
            {pendingRequest.amountDue} · 요청일 {new Date(pendingRequest.createdAt).toLocaleString("ko-KR")}
          </p>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-medium text-zinc-800">상위 요금제로 변경 요청</h2>
        <p className="mt-1 text-sm text-zinc-600">
          추가 비용(Rs, 연간 기준) 납부 후 슈퍼관리자가 승인하면 좌석 상한이 늘어납니다.
        </p>
        {canRequestUpgrade && (
          <div className="mt-4">
            <label className="text-sm text-zinc-600">메모 (선택)</label>
            <input
              className="mt-1 w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="송금자명·입금일 등"
            />
          </div>
        )}
        {!canRequestUpgrade && (
          <p className="mt-2 text-xs text-zinc-500">상향 요청은 회사관리자·인사만 등록할 수 있습니다.</p>
        )}
        <ul className="mt-4 space-y-2">
          {upgradeTiers.length === 0 && <li className="text-sm text-zinc-500">더 높은 구간이 없습니다.</li>}
          {upgradeTiers.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"
            >
              <span className="text-sm">
                {t.label ?? `${t.minSeats}–${t.maxSeats}명`} — <strong>Rs.{t.pricePerYear}</strong>/년
              </span>
              {canRequestUpgrade && (
                <button
                  type="button"
                  disabled={loading || !!pendingRequest}
                  onClick={() => void requestUpgrade(t.id)}
                  className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  이 구간으로 요청
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
