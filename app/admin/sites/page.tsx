"use client";

import { useCallback, useEffect, useState } from "react";

type Site = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowedRadius: number;
  expectedCheckIn: string | null;
  expectedCheckOut: string | null;
};

export default function AdminSitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("100");
  const [inT, setInT] = useState("09:00");
  const [outT, setOutT] = useState("18:00");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/sites");
    const j = await r.json();
    if (r.ok) setSites(j.sites ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const latitude = Number(lat);
    const longitude = Number(lng);
    const allowedRadius = Number(radius);
    const res = await fetch("/api/admin/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        latitude,
        longitude,
        allowedRadius,
        expectedCheckIn: inT || null,
        expectedCheckOut: outT || null,
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(j.error ? JSON.stringify(j.error) : "저장 실패");
      return;
    }
    setName("");
    setLat("");
    setLng("");
    setMsg("저장되었습니다.");
    await load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">근무지 목록</h1>
        <ul className="mt-4 space-y-2">
          {sites.map((s) => (
            <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="font-medium text-slate-900">{s.name}</p>
              <p className="text-xs text-slate-500">
                반경 {Math.round(s.allowedRadius)}m · {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
              </p>
              {(s.expectedCheckIn || s.expectedCheckOut) && (
                <p className="text-xs text-slate-600">
                  기준 {s.expectedCheckIn ?? "—"} ~ {s.expectedCheckOut ?? "—"}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-900">근무지 추가</h2>
        <form onSubmit={create} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <label className="text-sm font-medium text-slate-700">이름</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium text-slate-700">위도</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">경도</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">허용 반경 (m)</label>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min={1}
              max={5000}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium text-slate-700">출근 기준 (HH:mm)</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={inT}
                onChange={(e) => setInT(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">퇴근 기준 (HH:mm)</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={outT}
                onChange={(e) => setOutT(e.target.value)}
              />
            </div>
          </div>
          {msg && <p className="text-sm text-slate-700">{msg}</p>}
          <button type="submit" className="w-full rounded-xl bg-sky-600 py-2 font-medium text-white hover:bg-sky-700">
            등록
          </button>
        </form>
      </div>
    </div>
  );
}
