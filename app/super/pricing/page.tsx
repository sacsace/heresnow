"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { priceSuffix } from "@/lib/pricing";
import {
  bannerInfo,
  btnDanger,
  btnPrimary,
  btnSecondary,
  emptyStateCompact,
  inputTableLabel,
  inputTableNum,
  inputTablePrice,
  pageStackDetail,
  segmentedBtn,
  segmentedWrap,
  tableHead,
  tableFooterBar,
  tablePricing,
  tableRow,
  tableWrap,
  td,
  th,
} from "@/lib/uiStyles";
import type { BillingPeriod } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";

type Tier = {
  id: string;
  minSeats: number;
  maxSeats: number;
  billingPeriod: BillingPeriod;
  priceAmount: number;
  currency: string;
  label: string | null;
  sortOrder: number;
  trialDays: number | null;
};

export default function SuperPricingPage() {
  const [period, setPeriod] = useState<BillingPeriod>("YEARLY");
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [draft, setDraft] = useState<Record<string, Partial<Tier>>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    try {
      const r = await fetch(`/api/super/pricing-tiers?period=${period}`);
      const text = await r.text();
      let j: { tiers?: Tier[]; error?: string } = {};
      if (text.trim()) {
        try {
          j = JSON.parse(text) as { tiers?: Tier[]; error?: string };
        } catch {
          setMsg("서버 응답을 JSON으로 읽을 수 없습니다.");
          return;
        }
      }
      if (!r.ok) {
        setMsg(typeof j.error === "string" ? j.error : `불러오기 실패 (${r.status})`);
        return;
      }
      setTiers(j.tiers ?? []);
      setDraft({});
    } catch {
      setMsg("네트워크 오류로 요금제를 불러오지 못했습니다.");
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  function field(id: string, key: keyof Tier, value: string, num = false) {
    setDraft((d) => ({
      ...d,
      [id]: {
        ...d[id],
        [key]: num ? (value === "" ? undefined : Number(value)) : value,
      },
    }));
  }

  function trialDaysCell(t: Tier): string {
    const d = draft[t.id]?.trialDays;
    if (d !== undefined) return d === null ? "" : String(d);
    return t.trialDays == null ? "" : String(t.trialDays);
  }

  function setTrialDays(id: string, raw: string) {
    setDraft((d) => ({
      ...d,
      [id]: {
        ...d[id],
        trialDays: raw === "" ? null : Number(raw),
      },
    }));
  }

  async function save() {
    setMsg(null);
    const payload = tiers.map((t) => {
      const m = { ...t, ...(draft[t.id] ?? {}) };
      const trialRaw = m.trialDays;
      const trialDays =
        trialRaw === null || trialRaw === undefined || (typeof trialRaw === "number" && !Number.isFinite(trialRaw))
          ? null
          : Number(trialRaw);
      return {
        id: m.id,
        billingPeriod: m.billingPeriod,
        minSeats: Number(m.minSeats),
        maxSeats: Number(m.maxSeats),
        priceAmount: Number(m.priceAmount),
        label: m.label ?? null,
        sortOrder: Number(m.sortOrder),
        trialDays: trialDays !== null && trialDays > 0 ? trialDays : null,
      };
    });
    const r = await fetch("/api/super/pricing-tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiers: payload }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(j.error ?? "저장 실패");
      return;
    }
    setTiers(j.tiers?.filter((t: Tier) => t.billingPeriod === period) ?? []);
    setDraft({});
    setMsg("저장했습니다.");
  }

  async function addTier() {
    setMsg(null);
    const r = await fetch("/api/super/pricing-tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billingPeriod: period,
        minSeats: 1,
        maxSeats: 10,
        priceAmount: period === "MONTHLY" ? 100 : 1000,
        label: null,
        sortOrder: tiers.length,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg(typeof j.error === "string" ? j.error : "구간 추가 실패");
      return;
    }
    await load();
    setMsg("구간을 추가했습니다.");
  }

  async function removeTier(t: Tier) {
    const label = t.label?.trim() || `${t.minSeats}–${t.maxSeats}명`;
    if (!window.confirm(`「${label}」 구간을 삭제할까요?`)) return;

    setMsg(null);
    const r = await fetch(`/api/super/pricing-tiers/${t.id}`, { method: "DELETE" });
    const j = (await r.json().catch(() => ({}))) as { error?: string; warning?: string };
    if (!r.ok) {
      setMsg(typeof j.error === "string" ? j.error : "구간 삭제 실패");
      return;
    }
    setTiers((prev) => prev.filter((row) => row.id !== t.id));
    setDraft((d) => {
      const next = { ...d };
      delete next[t.id];
      return next;
    });
    setMsg(j.warning ?? "구간을 삭제했습니다.");
  }

  function val(t: Tier, key: keyof Tier): string | number {
    const v = draft[t.id]?.[key];
    if (v !== undefined && v !== null) return v as string | number;
    return t[key] as string | number;
  }

  const priceColLabel = period === "MONTHLY" ? "월 요금 (Rs)" : "연 요금 (Rs)";

  return (
    <div className={pageStackDetail}>
      <PageHeader
        title="요금제 (Rs)"
        subtitle="슈퍼관리자만 수정 가능. 체험일이 있으면 가입 시 구독 만료가 해당 일수 뒤로 설정됩니다. 비우면 월·연 각각 1개월·1년 로직입니다."
        actions={
          <div className={segmentedWrap}>
            <button type="button" onClick={() => setPeriod("MONTHLY")} className={segmentedBtn(period === "MONTHLY")}>
              월간
            </button>
            <button type="button" onClick={() => setPeriod("YEARLY")} className={segmentedBtn(period === "YEARLY")}>
              연간
            </button>
          </div>
        }
      />

      {msg && <p className={bannerInfo}>{msg}</p>}

      <div className={tableWrap}>
        {tiers.length === 0 ? (
          <p className={emptyStateCompact}>등록된 구간이 없습니다.</p>
        ) : (
          <table className={tablePricing}>
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "17%" }} />
            </colgroup>
            <thead className={tableHead}>
              <tr>
                <th className={th}>표시 이름</th>
                <th className={`${th} text-center`}>최소 좌석</th>
                <th className={`${th} text-center`}>최대 좌석</th>
                <th className={`${th} text-right`}>{priceColLabel}</th>
                <th className={`${th} text-center`}>체험일</th>
                <th className={`${th} text-center`}>정렬</th>
                <th className={`${th} text-right`}>액션</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id} className={tableRow}>
                  <td className={td}>
                    <input
                      className={inputTableLabel}
                      value={String(val(t, "label") ?? "")}
                      onChange={(e) => field(t.id, "label", e.target.value)}
                    />
                  </td>
                  <td className={`${td} text-center`}>
                    <input
                      type="number"
                      className={inputTableNum}
                      value={val(t, "minSeats") as number}
                      onChange={(e) => field(t.id, "minSeats", e.target.value, true)}
                    />
                  </td>
                  <td className={`${td} text-center`}>
                    <input
                      type="number"
                      className={inputTableNum}
                      value={val(t, "maxSeats") as number}
                      onChange={(e) => field(t.id, "maxSeats", e.target.value, true)}
                    />
                  </td>
                  <td className={td}>
                    <div className="flex items-center justify-end gap-1.5">
                      <input
                        type="number"
                        className={inputTablePrice}
                        value={val(t, "priceAmount") as number}
                        onChange={(e) => field(t.id, "priceAmount", e.target.value, true)}
                      />
                      <span className="shrink-0 text-[0.8125rem] text-[var(--apple-label-tertiary)]">
                        {priceSuffix(period)}
                      </span>
                    </div>
                  </td>
                  <td className={`${td} text-center`}>
                    <input
                      type="number"
                      min={0}
                      max={366}
                      placeholder="—"
                      className={inputTableNum}
                      value={trialDaysCell(t)}
                      onChange={(e) => setTrialDays(t.id, e.target.value)}
                    />
                  </td>
                  <td className={`${td} text-center`}>
                    <input
                      type="number"
                      className={inputTableNum}
                      value={val(t, "sortOrder") as number}
                      onChange={(e) => field(t.id, "sortOrder", e.target.value, true)}
                    />
                  </td>
                  <td className={`${td} text-right`}>
                    <button type="button" className={btnDanger} onClick={() => void removeTier(t)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className={tableFooterBar}>
          <button type="button" onClick={() => void save()} className={btnPrimary}>
            저장
          </button>
          <button type="button" onClick={() => void addTier()} className={btnSecondary}>
            구간 추가
          </button>
        </div>
      </div>
    </div>
  );
}
