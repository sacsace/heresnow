"use client";

import { StaticMap } from "@/components/admin/StaticMap";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  type: string;
  timestamp: string;
  status: string;
  latitude: number;
  longitude: number;
  distanceFromSite: number;
  isLate: boolean;
  isEarlyLeave: boolean;
  memo: string | null;
  employee: { name: string };
  site: { name: string };
};

export default function AdminAttendancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    const r = await fetch(`/api/admin/attendance?${q.toString()}`);
    const j = await r.json();
    if (r.ok) setRows(j.records ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function badge(s: string) {
    if (s === "APPROVED") return "bg-emerald-100 text-emerald-800";
    if (s === "PENDING") return "bg-amber-100 text-amber-900";
    return "bg-red-100 text-red-800";
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">출퇴근 기록</h1>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">전체 상태</option>
            <option value="APPROVED">APPROVED</option>
            <option value="PENDING">PENDING</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <a
            href="/api/admin/export"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            Excel
          </a>
        </div>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">불러오는 중…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">시각</th>
                <th className="px-3 py-2">직원</th>
                <th className="px-3 py-2">유형</th>
                <th className="px-3 py-2">근무지</th>
                <th className="px-3 py-2">거리</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">지각/조퇴</th>
                <th className="px-3 py-2">지도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {new Date(r.timestamp).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2">{r.employee.name}</td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2">{r.site.name}</td>
                  <td className="px-3 py-2">{Math.round(r.distanceFromSite)}m</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badge(r.status)}`}>{r.status}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {r.isLate ? "지각 " : ""}
                    {r.isEarlyLeave ? "조퇴" : ""}
                    {!r.isLate && !r.isEarlyLeave ? "—" : ""}
                  </td>
                  <td className="px-3 py-2">
                    <StaticMap lat={r.latitude} lng={r.longitude} label={r.employee.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
