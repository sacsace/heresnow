"use client";

import { FaceCapture } from "@/components/employee/FaceCapture";
import { StaticMap } from "@/components/admin/StaticMap";
import { useI18n } from "@/components/LanguageProvider";
import type { AttendanceType } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";

type RecordRow = {
  id: string;
  type: AttendanceType;
  timestamp: string;
  status: string;
  distanceFromSite: number;
  latitude: number;
  longitude: number;
  memo: string | null;
  isBusinessTrip: boolean;
  businessTripLocation: string | null;
  businessTripReason: string | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  isOvertime: boolean;
  isHolidayWork: boolean;
  overtimeMinutes: number;
  site: { name: string } | null;
  exception: { status: string } | null;
};

export function PunchCard() {
  const { t } = useI18n();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [checkInMode, setCheckInMode] = useState<"normal" | "businessTrip">("normal");
  const [businessTripLocation, setBusinessTripLocation] = useState("");
  const [businessTripReason, setBusinessTripReason] = useState("");
  const [memo, setMemo] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [faceRecognitionEnabled, setFaceRecognitionEnabled] = useState<boolean | null>(null);
  const [faceEnrolled, setFaceEnrolled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);

  const loadFaceStatus = useCallback(async () => {
    const r = await fetch("/api/employee/face");
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const enabled = Boolean((j as { faceRecognitionEnabled?: boolean }).faceRecognitionEnabled);
      setFaceRecognitionEnabled(enabled);
      setFaceEnrolled(
        enabled ? Boolean((j as { enrolled?: boolean }).enrolled) : true
      );
    } else {
      setFaceRecognitionEnabled(true);
      setFaceEnrolled(false);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    const r = await fetch("/api/attendance/me?limit=20");
    const j = await r.json();
    if (r.ok) setRecords(j.records ?? []);
  }, []);

  useEffect(() => {
    void loadFaceStatus();
    void loadRecords();
  }, [loadFaceStatus, loadRecords]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function clearPhoto() {
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function onPhotoSelected(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg(t("employee.photoInvalidType"));
      return;
    }
    if (file.size > 900_000) {
      setMsg(t("employee.photoTooLarge"));
      clearPhoto();
      return;
    }
    setMsg(null);
    setPhotoFile(file);
  }

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
      setMsg(t("employee.photoTooLarge"));
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

  function validateBusinessTripFields(): boolean {
    if (checkInMode !== "businessTrip") return true;
    if (!businessTripLocation.trim()) {
      setMsg(t("employee.businessTripLocationRequired"));
      return false;
    }
    if (!businessTripReason.trim()) {
      setMsg(t("employee.businessTripReasonRequired"));
      return false;
    }
    return true;
  }

  async function submitCheckIn(faceDescriptor?: number[]) {
    if (!validateBusinessTripFields()) return;

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
          type: "CHECK_IN",
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          isBusinessTrip: checkInMode === "businessTrip",
          businessTripLocation:
            checkInMode === "businessTrip" ? businessTripLocation.trim() : undefined,
          businessTripReason:
            checkInMode === "businessTrip" ? businessTripReason.trim() : undefined,
          memo: checkInMode === "normal" ? memo.trim() || undefined : undefined,
          photoUrl: photoUrl || undefined,
          ...(faceDescriptor ? { faceDescriptor } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = j.error as unknown;
        setMsg(
          typeof err === "string"
            ? err
            : err != null
              ? JSON.stringify(err)
              : "저장에 실패했습니다."
        );
        setBusy(false);
        return;
      }
      setMsg(j.message ?? "저장되었습니다.");
      setMemo("");
      setBusinessTripLocation("");
      setBusinessTripReason("");
      setCheckInMode("normal");
      clearPhoto();
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

  async function submitCheckOut() {
    setMsg(null);
    setBusy(true);
    try {
      const pos = await readPositionOnce();
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const acc = pos.coords.accuracy;
      setPreviewCoords({ lat, lng });

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "CHECK_OUT",
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          memo: memo.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = j.error as unknown;
        setMsg(
          typeof err === "string"
            ? err
            : err != null
              ? JSON.stringify(err)
              : "저장에 실패했습니다."
        );
        setBusy(false);
        return;
      }
      setMsg(j.message ?? "저장되었습니다.");
      setMemo("");
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

  const faceRequired = faceRecognitionEnabled !== false;
  const readyForPunch =
    faceRecognitionEnabled !== null && (!faceRequired || faceEnrolled === true);

  return (
    <div className="min-w-0 space-y-6">
      <section className="rounded-xl border border-zinc-200/80 bg-white p-3 sm:p-4 md:p-5">
        <p className="text-xs text-zinc-500">
          출근·퇴근 버튼을 누르는 순간의 위치만 사용합니다. 백그라운드 추적은 없습니다.
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          {faceRequired ? t("employee.checkInLeadWithFace") : t("employee.checkInLeadNoFace")}
        </p>

        {faceRecognitionEnabled === null && (
          <p className="mt-4 text-sm text-zinc-500">{t("common.loading")}</p>
        )}

        {faceRequired && faceEnrolled === false && (
          <div className="mt-4">
            <FaceCapture
              mode="enroll"
              disabled={busy}
              onEnrolled={() => {
                setFaceEnrolled(true);
                setMsg(t("employee.faceEnrollOk"));
              }}
              onError={setMsg}
            />
          </div>
        )}

        {readyForPunch && (
          <>
            <div className="mt-4 flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCheckInMode("normal")}
                className={`min-h-[2.5rem] flex-1 touch-manipulation rounded-md px-2 text-sm font-medium transition-colors ${
                  checkInMode === "normal"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {t("employee.checkInModeNormal")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCheckInMode("businessTrip")}
                className={`min-h-[2.5rem] flex-1 touch-manipulation rounded-md px-2 text-sm font-medium transition-colors ${
                  checkInMode === "businessTrip"
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {t("employee.checkInModeBusinessTrip")}
              </button>
            </div>

            {checkInMode === "businessTrip" && (
              <div className="mt-4 space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 sm:p-4">
                <p className="text-xs text-amber-900/90">
                  {faceRequired ? t("employee.businessTripHint") : t("employee.businessTripHintNoFace")}
                </p>
                <label className="block text-sm font-medium text-zinc-700">
                  {t("employee.businessTripLocationLabel")}
                  <span className="text-red-600"> *</span>
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                  value={businessTripLocation}
                  onChange={(e) => setBusinessTripLocation(e.target.value)}
                  placeholder={t("employee.businessTripLocationPlaceholder")}
                  maxLength={200}
                  disabled={busy}
                />
                <label className="block text-sm font-medium text-zinc-700">
                  {t("employee.businessTripReasonLabel")}
                  <span className="text-red-600"> *</span>
                </label>
                <textarea
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
                  rows={3}
                  value={businessTripReason}
                  onChange={(e) => setBusinessTripReason(e.target.value)}
                  placeholder={t("employee.businessTripReasonPlaceholder")}
                  maxLength={2000}
                  disabled={busy}
                />
              </div>
            )}

            {faceRequired ? (
              <div className="mt-4">
                <FaceCapture
                  mode="verify"
                  disabled={busy}
                  onVerified={(descriptor) => void submitCheckIn(descriptor)}
                  onError={setMsg}
                />
              </div>
            ) : (
              <div className="mt-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitCheckIn()}
                  className="min-h-[3rem] w-full touch-manipulation rounded-xl bg-emerald-500 py-3 text-base font-semibold text-white hover:bg-emerald-600 active:bg-emerald-700 disabled:opacity-50 sm:min-h-[3.25rem] sm:py-4"
                >
                  {t("employee.checkInButton")}
                </button>
              </div>
            )}
          </>
        )}

        {readyForPunch && checkInMode === "normal" && (
          <>
            <label className="mt-4 block text-sm font-medium text-zinc-600">
              {t("employee.memoOptional")}
            </label>
            <textarea
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="선택 입력"
            />
          </>
        )}

        {readyForPunch && (
          <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/80 p-3 sm:p-4">
            <p className="text-sm font-medium text-zinc-900">{t("employee.photoCheckInLabel")}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{t("employee.photoAttached")}</p>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => onPhotoSelected(e.target.files?.[0] ?? null)}
            />
            {!photoPreviewUrl ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => photoInputRef.current?.click()}
                className="mt-3 flex min-h-[2.75rem] w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-700 active:bg-zinc-50 disabled:opacity-50"
              >
                <CameraIcon />
                {t("employee.photoTakeButton")}
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreviewUrl}
                  alt=""
                  className="mx-auto max-h-40 w-full rounded-lg border border-zinc-200 object-contain"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => photoInputRef.current?.click()}
                    className="touch-manipulation rounded-lg border border-zinc-200 bg-white py-2 text-sm font-medium text-zinc-700 disabled:opacity-50"
                  >
                    {t("employee.photoRetake")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={clearPhoto}
                    className="touch-manipulation rounded-lg border border-zinc-200 bg-white py-2 text-sm font-medium text-red-600 disabled:opacity-50"
                  >
                    {t("employee.photoRemove")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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

        {readyForPunch && (
          <div className="mt-6">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitCheckOut()}
              className="min-h-[3rem] w-full touch-manipulation rounded-xl bg-sky-500 py-3 text-base font-semibold text-white hover:bg-sky-600 active:bg-sky-700 disabled:opacity-50 sm:min-h-[3.25rem] sm:py-4"
            >
              {t("employee.checkOutOnly")}
            </button>
          </div>
        )}

        {msg && <p className="mt-3 break-words text-center text-sm text-zinc-600">{msg}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-800">최근 기록</h2>
        <ul className="mt-2 space-y-2">
          {records.map((r) => (
            <li key={r.id} className="rounded-xl border border-zinc-200/80 bg-white p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-zinc-900">
                  {r.type === "CHECK_IN" ? "출근" : "퇴근"}
                  {r.isBusinessTrip && r.businessTripLocation
                    ? ` · 출장 ${r.businessTripLocation}`
                    : r.site?.name
                      ? ` · ${r.site.name}`
                      : ""}
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
              {(r.isHolidayWork || r.isLate || r.isEarlyLeave || r.isOvertime) && (
                <p className="text-xs text-zinc-600">
                  {r.isHolidayWork && (
                    <span className="text-violet-700">{t("employee.flagHolidayWork")} </span>
                  )}
                  {r.isLate && (
                    <span className="text-amber-800">{t("employee.flagLate")} </span>
                  )}
                  {r.isEarlyLeave && (
                    <span className="text-amber-800">{t("employee.flagEarlyLeave")} </span>
                  )}
                  {r.isOvertime && (
                    <span className="text-sky-800">
                      {t("employee.flagOvertime")}
                      {r.overtimeMinutes > 0 ? ` ${r.overtimeMinutes}${t("employee.flagMinutes")}` : ""}{" "}
                    </span>
                  )}
                </p>
              )}
              {r.isBusinessTrip && r.businessTripReason && (
                <p className="text-xs text-zinc-600">사유: {r.businessTripReason}</p>
              )}
              {r.exception && <p className="text-xs text-zinc-600">예외: {r.exception.status}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
