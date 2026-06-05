"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import {
  bannerInfo,
  btnPrimary,
  card,
  cardBody,
  hint,
  input,
  label,
  pageStackDetail,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

export default function SuperPricingPage() {
  const [priceInput, setPriceInput] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch("/api/super/unit-price");
      const j = (await r.json().catch(() => ({}))) as {
        pricePerUser?: number;
        currency?: string;
        error?: string;
      };
      if (!r.ok) {
        setMsg(typeof j.error === "string" ? j.error : "불러오기 실패");
        return;
      }
      setPriceInput(String(j.pricePerUser ?? 0));
      setCurrency(j.currency ?? "INR");
    } catch {
      setMsg("네트워크 오류로 요금을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const pricePerUser = parseInt(priceInput, 10);
    if (!Number.isFinite(pricePerUser) || pricePerUser < 0) {
      setMsg("0 이상의 정수를 입력하세요.");
      return;
    }

    setMsg(null);
    setSaving(true);
    try {
      const r = await fetch("/api/super/unit-price", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pricePerUser }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        pricePerUser?: number;
        error?: string;
      };
      if (!r.ok) {
        setMsg(typeof j.error === "string" ? j.error : "저장 실패");
        return;
      }
      setPriceInput(String(j.pricePerUser ?? pricePerUser));
      setMsg("저장했습니다. 모든 회사에 동일 단가가 적용됩니다.");
    } catch {
      setMsg("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={pageStackDetail}>
      <PageHeader
        title="요금표"
        subtitle="1인당 월 이용 요금만 설정합니다. 청구 = 인원수 × 아래 단가 × 사용 개월."
        subtitleWide
      />

      {msg && <p className={bannerInfo}>{msg}</p>}

      <div className={card}>
        <div className={`${cardBody} max-w-md space-y-6`}>
          {loading ? (
            <p className="text-[var(--apple-label-secondary)]">불러오는 중…</p>
          ) : (
            <>
              <div>
                <label className={label} htmlFor="unit-price">
                  1인당 월 요금 (Rs)
                </label>
                <p className={`mt-1 ${hint}`}>
                  한 달, 한 명 기준 이용 비용입니다. ({currency})
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-[0.9375rem] text-[var(--apple-label-secondary)]">Rs.</span>
                  <input
                    id="unit-price"
                    type="number"
                    min={0}
                    step={1}
                    className={`${input} flex-1 text-[1.125rem] font-semibold`}
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                  />
                  <span className="shrink-0 text-[0.875rem] text-[var(--apple-label-secondary)]">
                    /인·월
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-[var(--fill-tertiary)] px-4 py-3 text-[0.8125rem] leading-relaxed text-[var(--apple-label-secondary)]">
                예: 50명 × Rs.{priceInput || "0"} × 3개월 = Rs.
                {Math.max(0, parseInt(priceInput, 10) || 0) * 50 * 3}
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className={btnPrimary + " w-full sm:w-auto min-w-[8rem]"}
              >
                {saving ? "저장 중…" : "저장"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
