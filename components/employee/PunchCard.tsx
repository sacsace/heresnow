"use client";

import type { AttendanceType } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";

type Site = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowedRadius: number;
};

type RecordRow = {
  id: string;
  type: AttendanceType;
  timestamp: string;
  status: string;
  distanceFromSite: number;
  memo: string | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  site: { name: string };
  exception: { status: string } | null;
};

export function PunchCard() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [memo, setMemo] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);

  const loadSites = useCallback(async () => {
    const r = await fetch("/api/sites");
    const j = await r.json();
    if (r.ok && j.sites?.length) {
      setSites(j.sites);
      setSiteId((id) => id || j.sites[0].id);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    const r = await fetch("/api/attendance/me?limit=20");
    const j = await r.json();
    if (r.ok) setRecords(j.records ?? []);
  }, []);

  useEffect(() => {
    void loadSites();
    void loadRecords();
  }, [loadSites, loadRecords]);

  function readPositionOnce(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("이 브라우저는 위치 정보를 지원하지 않습니다."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      });
    });
  }

  async function captureLocationPreview() {
    setGeoError(null);
    setMsg(null);
    try {
      const pos = await readPositionOnce();
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        acc: pos.coords.accuracy,
      });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e) {
        setGeoError(String((e as { message?: string }).message));
      } else {
        setGeoError("위치를 가져오지 못했습니다.");
      }
    }
  }

  async function fileToDataUrl(f: File): Promise<string | null> {
    if (f.size > 900_000) {
      setMsg("사진은 약 900KB 이하로 올려 주세요.");
      return null;
    }
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => reject(new Error("read fail"));
      r.readAsDataURL(f);
    });
  }

  async function submit(type: AttendanceType) {
    setMsg(null);
    setBusy(true);
    try {
      let lat = coords?.lat;
      let lng = coords?.lng;
      let acc = coords?.acc;
      if (lat == null || lng == null) {
        const pos = await readPositionOnce();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        acc = pos.coords.accuracy;
        setCoords({ lat, lng, acc });
      }
      let photoUrl: string | null = null;
      if (photoFile) {
        photoUrl = await fileToDataUrl(photoFile);
        if (!photoUrl) {
          setBusy(false);
          return;
        }
      }
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          siteId,
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          memo: memo.trim() || undefined,
          photoUrl: photoUrl || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j.error ? JSON.stringify(j.error) : "저장에 실패했습니다.");
        setBusy(false);
        return;
      }
      setMsg(j.message ?? "저장되었습니다.");
      setMemo("");
      setPhotoFile(null);
      await loadRecords();
    } catch {
      setMsg("네트워크 오류가 발생했습니다.");
    }
    setBusy(false);
  }

  const selected = sites.find((s) => s.id === siteId);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">근무지 / 출장지</label>
        <select
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
        >
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {selected && (
          <p className="mt-2 text-xs text-slate-500">
            허용 반경 약 {Math.round(selected.allowedRadius)}m · 기준 좌표{" "}
            {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
          </p>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">메모 (예외 사유 등)</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          rows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="선택 입력"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">사진 인증 (선택)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-1 w-full text-sm"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
        />

        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">위치 미리보기 (선택)</p>
          <p className="text-xs text-slate-500">
            버튼을 누를 때마다 그 순간만 위치를 읽습니다. 백그라운드 추적 없음.
          </p>
          <button
            type="button"
            className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
            onClick={() => void captureLocationPreview()}
          >
            지금 위치만 가져오기
          </button>
          {coords && (
            <p className="mt-2 text-xs">
              {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              {coords.acc != null ? ` · 정확도 ~${Math.round(coords.acc)}m` : ""}
            </p>
          )}
          {geoError && <p className="mt-1 text-xs text-amber-700">{geoError}</p>}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy || !siteId}
            onClick={() => void submit("CHECK_IN")}
            className="rounded-2xl bg-emerald-600 py-5 text-lg font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            출근
          </button>
          <button
            type="button"
            disabled={busy || !siteId}
            onClick={() => void submit("CHECK_OUT")}
            className="rounded-2xl bg-slate-800 py-5 text-lg font-semibold text-white shadow hover:bg-slate-900 disabled:opacity-50"
          >
            퇴근
          </button>
        </div>
        {msg && <p className="mt-3 text-center text-sm text-slate-700">{msg}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-800">최근 기록</h2>
        <ul className="mt-2 space-y-2">
          {records.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-slate-900">
                  {r.type === "CHECK_IN" ? "출근" : "퇴근"} · {r.site.name}
                </span>
                <span
                  className={
                    r.status === "APPROVED"
                      ? "text-emerald-700"
                      : r.status === "PENDING"
                        ? "text-amber-700"
                        : "text-red-700"
                  }
                >
                  {r.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {new Date(r.timestamp).toLocaleString("ko-KR")} · 거리 약 {Math.round(r.distanceFromSite)}m
              </p>
              {(r.isLate || r.isEarlyLeave) && (
                <p className="text-xs text-amber-800">
                  {r.isLate ? "지각 " : ""}
                  {r.isEarlyLeave ? "조퇴" : ""}
                </p>
              )}
              {r.exception && (
                <p className="text-xs text-slate-600">예외: {r.exception.status}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
