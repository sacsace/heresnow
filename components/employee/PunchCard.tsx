"use client";

import { StaticMap } from "@/components/admin/StaticMap";
import type { AttendanceType } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";

type RecordRow = {
  id: string;
  type: AttendanceType;
  timestamp: string;
  status: string;
  distanceFromSite: number;
  latitude: number;
  longitude: number;
  memo: string | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  site: { name: string } | null;
  exception: { status: string } | null;
};

export function PunchCard() {
  const [memo, setMemo] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);

  const loadRecords = useCallback(async () => {
    const r = await fetch("/api/attendance/me?limit=20");
    const j = await r.json();
    if (r.ok) setRecords(j.records ?? []);
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

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

  async function loadMapPreview() {
    setMapBusy(true);
    setMsg(null);
    try {
      const pos = await readPositionOnce();
      setPreviewCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e) {
        setMsg(String((e as { message?: string }).message));
      } else {
        setMsg("위치를 가져오지 못했습니다.");
      }
    }
    setMapBusy(false);
  }

  async function submit(type: AttendanceType) {
    setMsg(null);
    setBusy(true);
    try {
      const pos = await readPositionOnce();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;
      setPreviewCoords({ lat, lng });

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
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e) {
        setMsg(String((e as { message?: string }).message));
      } else {
        setMsg("위치를 가져오지 못했거나 네트워크 오류가 발생했습니다.");
      }
    }
    setBusy(false);
  }

  return (
    <div className="min-w-0 space-y-6">
      <section className="rounded-xl border border-zinc-200/80 bg-white p-3 sm:p-4 md:p-5">
        <p className="text-xs text-zinc-500">
          출근·퇴근 버튼을 누르는 순간의 위치만 사용합니다. 백그라운드 추적은 없습니다.
        </p>

        <label className="mt-4 block text-sm font-medium text-zinc-600">메모 (예외 사유 등)</label>
        <textarea
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
          rows={2}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="선택 입력"
        />

        <label className="mt-4 block text-sm font-medium text-zinc-600">사진 인증 (선택)</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-1 w-full text-sm"
          onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
        />

        <div className="mt-4 rounded-lg border border-zinc-100 bg-zinc-50/80 p-2 sm:p-3">
          <p className="text-sm font-medium text-zinc-900">위치 지도</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            출근·퇴근 시 저장되는 좌표와 동일하게, 버튼을 누를 때만 위치를 읽습니다.
          </p>
          <button
            type="button"
            disabled={busy || mapBusy}
            onClick={() => void loadMapPreview()}
            className="mt-2 touch-manipulation rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {mapBusy ? "위치 읽는 중…" : "현재 위치를 지도에 표시"}
          </button>
          {previewCoords && (
            <div className="mt-3">
              <StaticMap
                lat={previewCoords.lat}
                lng={previewCoords.lng}
                label="현재 위치"
                noKeyFallback="embed"
              />
              <p className="mt-1 break-all text-[11px] text-zinc-400">
                {previewCoords.lat.toFixed(6)}, {previewCoords.lng.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 grid min-w-0 grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit("CHECK_IN")}
            className="min-h-[3rem] touch-manipulation rounded-xl bg-emerald-500 py-3 text-base font-semibold text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 sm:min-h-[3.25rem] sm:py-4"
          >
            출근
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit("CHECK_OUT")}
            className="min-h-[3rem] touch-manipulation rounded-xl bg-sky-500 py-3 text-base font-semibold text-white hover:bg-sky-600 active:bg-sky-700 disabled:opacity-50 sm:min-h-[3.25rem] sm:py-4"
          >
            퇴근
          </button>
        </div>
        {msg && (
          <p className="mt-3 break-words text-center text-sm text-zinc-600">{msg}</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-800">최근 기록</h2>
        <ul className="mt-2 space-y-2">
          {records.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-200/80 bg-white p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-zinc-900">
                  {r.type === "CHECK_IN" ? "출근" : "퇴근"}
                  {r.site?.name ? ` · ${r.site.name}` : ""}
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
              <p className="break-words text-xs text-zinc-500">
                {new Date(r.timestamp).toLocaleString("ko-KR")}
                {r.site && r.distanceFromSite > 0
                  ? ` · 거리 약 ${Math.round(r.distanceFromSite)}m`
                  : ` · ${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`}
              </p>
              {(r.isLate || r.isEarlyLeave) && (
                <p className="text-xs text-amber-800">
                  {r.isLate ? "지각 " : ""}
                  {r.isEarlyLeave ? "조퇴" : ""}
                </p>
              )}
              {r.exception && <p className="text-xs text-zinc-600">예외: {r.exception.status}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
