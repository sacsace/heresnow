"use client";

import { useCallback, useEffect, useState } from "react";

type Tier = {
  id: string;
  minSeats: number;
  maxSeats: number;
  pricePerYear: number;
  currency: string;
  label: string | null;
  sortOrder: number;
  trialDays: number | null;
};

export default function SuperPricingPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [draft, setDraft] = useState<Record<string, Partial<Tier>>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    try {
      const r = await fetch("/api/super/pricing-tiers");
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
    } catch {
      setMsg("네트워크 오류로 요금제를 불러오지 못했습니다.");
    }
  }, []);

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
        minSeats: Number(m.minSeats),
        maxSeats: Number(m.maxSeats),
        pricePerYear: Number(m.pricePerYear),
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
    setTiers(j.tiers ?? []);
    setDraft({});
    setMsg("저장했습니다.");
  }

  function val(t: Tier, key: keyof Tier): string | number {
    const v = draft[t.id]?.[key];
    if (v !== undefined && v !== null) return v as string | number;
    return t[key] as string | number;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">요금제 (Rs / 연)</h1>
      <p className="text-sm text-zinc-500">
        슈퍼관리자만 수정 가능. <strong className="font-medium text-zinc-700">체험일</strong>이 있으면 가입 시 구독 만료가
        해당 일수 뒤로 설정됩니다. 비우면 1년(연) 로직입니다.
      </p>
      {msg && <p className="text-sm text-sky-600">{msg}</p>}
      <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">표시 이름</th>
              <th className="px-3 py-2">최소 좌석</th>
              <th className="px-3 py-2">최대 좌석</th>
              <th className="px-3 py-2">연 요금 (Rs)</th>
              <th className="px-3 py-2">체험일</th>
              <th className="px-3 py-2">정렬</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id} className="border-t border-zinc-100">
                <td className="px-3 py-2">
                  <input
                    className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                    value={String(val(t, "label") ?? "")}
                    onChange={(e) => field(t.id, "label", e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-20 rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                    value={val(t, "minSeats") as number}
                    onChange={(e) => field(t.id, "minSeats", e.target.value, true)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-20 rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                    value={val(t, "maxSeats") as number}
                    onChange={(e) => field(t.id, "maxSeats", e.target.value, true)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                    value={val(t, "pricePerYear") as number}
                    onChange={(e) => field(t.id, "pricePerYear", e.target.value, true)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={366}
                    placeholder="—"
                    className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                    value={trialDaysCell(t)}
                    onChange={(e) => setTrialDays(t.id, e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                    value={val(t, "sortOrder") as number}
                    onChange={(e) => field(t.id, "sortOrder", e.target.value, true)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
      >
        저장
      </button>
    </div>
  );
}
