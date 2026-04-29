"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ConsentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function agree() {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/user/consent", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setErr("동의 저장에 실패했습니다.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-xl font-semibold text-slate-900">개인정보 수집·이용 동의</h1>
      <p className="mt-2 text-sm text-slate-600">
        HereNow는 <strong className="font-medium">실시간 위치 추적을 하지 않습니다.</strong> 출근/퇴근
        버튼을 누른 순간의 좌표와 시간만 저장합니다.
      </p>
      <section className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <div>
          <p className="font-medium text-slate-900">수집 항목</p>
          <ul className="mt-1 list-inside list-disc">
            <li>출퇴근 클릭 시점의 GPS 좌표(위도·경도)·정확도</li>
            <li>시각</li>
            <li>기기 정보(UA 등)</li>
            <li>선택: 메모, 사진 URL</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-slate-900">수집 목적</p>
          <p>출장·현장 근무 등 출퇴근 사실 확인</p>
        </div>
        <div>
          <p className="font-medium text-slate-900">수집하지 않는 항목</p>
          <ul className="mt-1 list-inside list-disc">
            <li>실시간 위치, 이동 경로</li>
            <li>근무시간 외 백그라운드 위치</li>
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          동의를 거부하면 출퇴근 제출 기능이 제한될 수 있습니다. 보관 기간은 회사 정책에 따릅니다.
        </p>
      </section>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={agree}
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? "처리 중…" : "동의하고 계속하기"}
      </button>
    </main>
  );
}
