"use client";

import { priceSuffix } from "@/lib/pricing";
import {
  bannerWarning,
  btnPrimary,
  card,
  cardBody,
  emptyState,
  errorText,
  groupedCard,
  groupedRow,
  hint,
  input,
  label,
  pageSubtitle,
  pageTitle,
  sectionLabel,
} from "@/lib/uiStyles";
import type { BillingPeriod } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Tier = {
  id: string;
  minSeats: number;
  maxSeats: number;
  billingPeriod: BillingPeriod;
  priceAmount: number;
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
    return <p className={errorText}>{error}</p>;
  }
  if (!data) {
    return <p className="text-[var(--apple-label-secondary)]">불러오는 중…</p>;
  }

  const { company, employeeCount, upgradeTiers, pendingRequest } = data;

  return (
    <div className="space-y-10 sm:space-y-12">
      <header>
        <h1 className={pageTitle}>요금·좌석</h1>
        <p className={pageSubtitle}>구독·좌석 상한 및 상위 요금제 변경 요청</p>
      </header>

      <section>
        <p className={sectionLabel}>{company.name}</p>
        <div className={card}>
          <dl className={`${cardBody} grid gap-4 sm:grid-cols-2`}>
            <div className="hig-divider pb-4 sm:pb-0 sm:border-b-0">
              <dt className={label}>현재 좌석 사용</dt>
              <dd className="mt-1 text-[1.0625rem] font-semibold">
                {employeeCount} / {company.seatLimit}명
              </dd>
            </div>
            <div className="hig-divider pb-4 sm:pb-0">
              <dt className={label}>구독 만료</dt>
              <dd className="mt-1 text-[1.0625rem] font-semibold">
                {company.subscriptionEndsAt
                  ? new Date(company.subscriptionEndsAt).toLocaleDateString("ko-KR")
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2 pt-2">
              <dt className={label}>적용 요금제</dt>
              <dd className="mt-1 text-[0.9375rem]">
                {company.pricingTier
                  ? `${company.pricingTier.label ?? `${company.pricingTier.minSeats}–${company.pricingTier.maxSeats}명`} · Rs.${company.pricingTier.priceAmount}${priceSuffix(company.pricingTier.billingPeriod)}`
                  : "미지정"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {pendingRequest && (
        <section className={bannerWarning}>
          <p className="font-semibold">승인 대기 중인 상향 요청</p>
          <p className="mt-1">
            목표:{" "}
            {pendingRequest.targetTier.label ??
              `${pendingRequest.targetTier.minSeats}–${pendingRequest.targetTier.maxSeats}명`}{" "}
            · Rs.
            {pendingRequest.amountDue} · 요청일{" "}
            {new Date(pendingRequest.createdAt).toLocaleString("ko-KR")}
          </p>
        </section>
      )}

      <section>
        <p className={sectionLabel}>상위 요금제로 변경 요청</p>
        <div className={card}>
          <div className={cardBody}>
            <p className={hint}>
              추가 비용(Rs, 월·연 요금제 기준) 납부 후 슈퍼관리자가 승인하면 좌석 상한이 늘어납니다.
            </p>
            {canRequestUpgrade && (
              <div className="mt-4 hig-divider pt-4">
                <label className={label}>메모 (선택)</label>
                <input
                  className={`${input} mt-1.5 max-w-md`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="송금자명·입금일 등"
                />
              </div>
            )}
            {!canRequestUpgrade && (
              <p className={`mt-3 ${hint}`}>상향 요청은 회사관리자·인사만 등록할 수 있습니다.</p>
            )}
          </div>
          <ul className={groupedCard}>
            {upgradeTiers.length === 0 && (
              <li className={emptyState}>더 높은 구간이 없습니다.</li>
            )}
            {upgradeTiers.map((t, i) => (
              <li
                key={t.id}
                className={`${groupedRow} flex flex-wrap items-center justify-between gap-2 ${
                  i < upgradeTiers.length - 1 ? "border-b border-[var(--separator)]" : ""
                }`}
              >
                <span className="text-[0.9375rem]">
                  {t.label ?? `${t.minSeats}–${t.maxSeats}명`} —{" "}
                  <strong>
                    Rs.{t.priceAmount}
                    {priceSuffix(t.billingPeriod)}
                  </strong>
                </span>
                {canRequestUpgrade && (
                  <button
                    type="button"
                    disabled={loading || !!pendingRequest}
                    onClick={() => void requestUpgrade(t.id)}
                    className={`${btnPrimary} !py-1.5 text-[0.875rem]`}
                  >
                    이 구간으로 요청
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
