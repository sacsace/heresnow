"use client";

import { StaticMap } from "@/components/admin/StaticMap";
import type { AdminAttendanceDayRow, AttendancePunchSummary } from "@/lib/adminAttendanceByDay";
import { useEffect, useState } from "react";

function badge(s: string) {
  if (s === "APPROVED") return "bg-emerald-100 text-emerald-800";
  if (s === "PENDING") return "bg-amber-100 text-amber-900";
  if (s === "MIXED") return "bg-zinc-100 text-zinc-700";
  return "bg-red-100 text-red-800";
}

function formatDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function locationLabel(p: AttendancePunchSummary) {
  if (p.isBusinessTrip && p.businessTripLocation) {
    return (
      <>
        {p.businessTripLocation}
        <span className="block text-zinc-400">출장 · GPS</span>
      </>
    );
  }
  if (p.site?.name) {
    return (
      <>
        {p.site.name}
        <span className="block text-zinc-400">약 {Math.round(p.distanceFromSite)}m</span>
      </>
    );
  }
  return (
    <>
      {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
      <span className="block text-zinc-400">GPS</span>
    </>
  );
}

export default function AdminAttendancePage() {
  const [rows, setRows] = useState<AdminAttendanceDayRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    const r = await fetch(`/api/admin/attendance?${q.toString()}`);
    const j = await r.json();
    if (r.ok) setRows(j.days ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900">출퇴근 기록</h1>
          <p className="mt-1 text-sm text-zinc-500">직원·날짜별로 하루 한 줄(출근·퇴근)로 표시합니다.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-zinc-300 px-2 py-1 text-sm"
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
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm text-white hover:bg-sky-600"
          >
            Excel
          </a>
        </div>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-zinc-500">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">표시할 기록이 없습니다.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">날짜</th>
                <th className="px-3 py-2">직원</th>
                <th className="px-3 py-2">출근</th>
                <th className="px-3 py-2">퇴근</th>
                <th className="px-3 py-2">출장</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">근태</th>
                <th className="px-3 py-2">지도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100">
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-800">
                    {formatDate(r.date)}
                    {r.incomplete && (
                      <span className="mt-0.5 block text-[11px] text-amber-700">미완료</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-zinc-900">{r.employeeName}</td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {r.checkIn ? (
                      <>
                        <span className="font-medium text-zinc-800">{r.checkIn.time}</span>
                        <span className="mt-0.5 block">{locationLabel(r.checkIn)}</span>
                      </>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {r.checkOut ? (
                      <>
                        <span className="font-medium text-zinc-800">{r.checkOut.time}</span>
                        <span className="mt-0.5 block">{locationLabel(r.checkOut)}</span>
                      </>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {r.checkIn?.isBusinessTrip ? (
                      <span title={r.checkIn.businessTripReason ?? ""}>
                        {r.checkIn.businessTripLocation ?? "출장"}
                        {r.checkIn.businessTripReason ? (
                          <span className="mt-0.5 block max-w-[12rem] truncate text-zinc-500">
                            {r.checkIn.businessTripReason}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badge(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {r.isHolidayWork && <span className="text-violet-700">휴일근무 </span>}
                    {r.isLate && <span className="text-amber-800">지각 </span>}
                    {r.isEarlyLeave && <span className="text-amber-800">조퇴 </span>}
                    {r.isOvertime && (
                      <span className="text-sky-800">
                        초과{r.overtimeMinutes > 0 ? ` ${r.overtimeMinutes}분` : ""}{" "}
                      </span>
                    )}
                    {!r.isHolidayWork &&
                      !r.isLate &&
                      !r.isEarlyLeave &&
                      !r.isOvertime &&
                      "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.checkIn ? (
                      <StaticMap
                        lat={r.checkIn.latitude}
                        lng={r.checkIn.longitude}
                        label={`${r.employeeName} 출근`}
                      />
                    ) : r.checkOut ? (
                      <StaticMap
                        lat={r.checkOut.latitude}
                        lng={r.checkOut.longitude}
                        label={`${r.employeeName} 퇴근`}
                      />
                    ) : (
                      "—"
                    )}
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
