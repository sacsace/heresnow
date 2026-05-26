"use client";

import { FaceCapture } from "@/components/employee/FaceCapture";
import { StaticMap } from "@/components/admin/StaticMap";
import { AttendanceTrustHero } from "@/components/ui/AttendanceTrustHero";
import { useI18n } from "@/components/LanguageProvider";
import { statusBadge } from "@/lib/statusBadge";
import {
  bannerInfo,
  bannerWarning,
  btnPrimary,
  btnSecondary,
  btnSuccessFull,
  card,
  cardBody,
  cardHeader,
  hint,
  input,
  label,
  segmentedBtn,
  segmentedWrap,
  successText,
  table,
  tableHead,
  tableRow,
  tableWrap,
  td,
  th,
} from "@/lib/uiStyles";
import { usePunchStatus } from "@/hooks/usePunchStatus";
import type { AttendanceType } from "@prisma/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  lateMinutes: number;
  overtimeMinutes: number;
  site: { name: string } | null;
  exception: { status: string } | null;
};

type PunchCardProps = {
  /** full: employee page · embedded: admin (no hero) */
  variant?: "full" | "embedded";
  showRecentRecords?: boolean;
};

export function PunchCard({ variant = "full", showRecentRecords }: PunchCardProps) {
  const embedded = variant === "embedded";
  const showRecords = showRecentRecords ?? !embedded;
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [checkInMode, setCheckInMode] = useState<"normal" | "businessTrip">("normal");
  const [businessTripLocation, setBusinessTripLocation] = useState("");
  const [businessTripReason, setBusinessTripReason] = useState("");
  const [earlyLeaveReason, setEarlyLeaveReason] = useState("");
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
  const { status: punchStatus, loading: punchStatusLoading, reload: reloadPunchStatus } =
    usePunchStatus();

  /**
   * records 는 timestamp DESC 정렬. 인접한 CHECK_IN ↔ CHECK_OUT 을 한 줄로 묶어
   * (출근, 퇴근) 쌍을 만든다. 매칭되지 않은 단독 기록은 한쪽이 null 인 쌍으로 표시.
   */
  const pairedRecords = useMemo(() => {
    const asc = [...records].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const pairs: { key: string; checkIn: RecordRow | null; checkOut: RecordRow | null }[] = [];
    let openCheckIn: RecordRow | null = null;
    for (const r of asc) {
      if (r.type === "CHECK_IN") {
        if (openCheckIn) {
          pairs.push({ key: openCheckIn.id, checkIn: openCheckIn, checkOut: null });
        }
        openCheckIn = r;
      } else {
        if (openCheckIn) {
          pairs.push({ key: `${openCheckIn.id}-${r.id}`, checkIn: openCheckIn, checkOut: r });
          openCheckIn = null;
        } else {
          pairs.push({ key: r.id, checkIn: null, checkOut: r });
        }
      }
    }
    if (openCheckIn) {
      pairs.push({ key: openCheckIn.id, checkIn: openCheckIn, checkOut: null });
    }
    return pairs.reverse();
  }, [records]);

  function checkInBlockMessage(): string | null {
    if (!punchStatus?.checkInBlock) return punchStatus?.checkInMessage ?? null;
    if (punchStatus.checkInBlock === "ALREADY_CHECKED_IN") return t("employee.alreadyCheckedIn");
    if (punchStatus.checkInBlock === "COOLDOWN") return t("employee.cooldownBlocked");
    return punchStatus.checkInMessage;
  }

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
      if (typeof window !== "undefined" && !window.isSecureContext) {
        reject(new Error(t("employee.geoInsecureContext")));
        return;
      }
      if (!navigator.geolocation) {
        reject(new Error(t("employee.geoUnsupported")));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          // iOS Safari 의 권한 거부/측위 실패에 사람이 읽을 수 있는 메시지 부여
          let msg = t("employee.geoFail");
          if (err && typeof err === "object" && "code" in err) {
            const code = (err as GeolocationPositionError).code;
            if (code === 1) msg = t("employee.geoPermissionDenied");
            else if (code === 2) msg = t("employee.geoPositionUnavailable");
            else if (code === 3) msg = t("employee.geoTimeout");
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        }
      );
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
        setMsg(t("employee.geoFail"));
      }
    }
    setMapBusy(false);
  }

  function validateBusinessTripFields(): boolean {
    if (checkInMode !== "businessTrip") return true;
    if (!businessTripReason.trim()) {
      setMsg(t("employee.businessTripReasonRequired"));
      return false;
    }
    return true;
  }

  async function submitCheckIn(faceDescriptor?: number[]) {
    if (!punchStatus?.canCheckIn) {
      setMsg(checkInBlockMessage() ?? t("employee.alreadyCheckedIn"));
      return;
    }
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
      await reloadPunchStatus();
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e) {
        setMsg(String((e as { message?: string }).message));
      } else {
        setMsg("위치를 가져오지 못했거나 네트워크 오류가 발생했습니다.");
      }
    }
    setBusy(false);
  }

  async function submitCheckOut(faceDescriptor?: number[]) {
    // 조퇴(정규 퇴근시각 이전 퇴근) 인 경우 사유 필수 — 클라이언트 선검증으로 즉시 안내
    if (punchStatus?.earlyLeaveExpected && !earlyLeaveReason.trim()) {
      setMsg(t("employee.earlyLeaveReasonRequired"));
      return;
    }

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
          earlyLeaveReason: earlyLeaveReason.trim() || undefined,
          ...(faceDescriptor ? { faceDescriptor } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 서버가 사유를 요구하는 케이스 — 사용자에게 입력 안내
        if (j.code === "EARLY_LEAVE_REASON_REQUIRED") {
          setMsg(t("employee.earlyLeaveReasonRequired"));
          setBusy(false);
          await reloadPunchStatus();
          return;
        }
        const err = j.error as unknown;
        setMsg(
          typeof err === "string"
            ? err
            : err != null
              ? JSON.stringify(err)
              : t("employee.saveFail")
        );
        setBusy(false);
        return;
      }
      setMsg(j.message ?? t("employee.saved"));
      setMemo("");
      setEarlyLeaveReason("");
      await loadRecords();
      await reloadPunchStatus();
    } catch (e: unknown) {
      if (e && typeof e === "object" && "message" in e) {
        setMsg(String((e as { message?: string }).message));
      } else {
        setMsg(t("employee.saveFail"));
      }
    }
    setBusy(false);
  }

  const faceRequired = faceRecognitionEnabled !== false;
  const faceStatusReady = faceRecognitionEnabled !== null && faceEnrolled !== null;
  const readyForPunch =
    faceStatusReady && (!faceRequired || faceEnrolled === true);
  const canCheckIn = Boolean(punchStatus?.canCheckIn);
  const canCheckOut = Boolean(punchStatus?.canCheckOut);
  const showCheckIn = readyForPunch && canCheckIn && !punchStatusLoading;
  /**
   * 등록 단계는 readyForPunch 가 false 일 수밖에 없으므로(faceEnrolled !== true),
   * showCheckIn 대신 canCheckIn + 상태 로드 완료 조건만으로 노출한다.
   * (이전 로직은 등록되지 않은 사용자에게 등록 화면이 영영 보이지 않는 버그가 있었음)
   */
  const showFaceEnroll =
    faceRequired &&
    faceStatusReady &&
    faceEnrolled === false &&
    canCheckIn &&
    !punchStatusLoading;
  const checkInNotice = checkInBlockMessage();

  return (
    <div className={embedded ? "min-w-0" : "min-w-0 space-y-6 sm:space-y-8"}>
      {!embedded && <AttendanceTrustHero variant="employee" />}

      <section className={card}>
        <div className={cardHeader}>
          <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{t("employee.punchSection")}</p>
          <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
            {faceRequired ? t("employee.checkInLeadWithFace") : t("employee.checkInLeadNoFace")}
          </p>
        </div>

        <div className={cardBody}>
        {punchStatusLoading && (
          <p className="text-[0.9375rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>
        )}

        {!punchStatusLoading && punchStatus?.isCheckedIn && (
          <p className={`${bannerInfo} mt-4`}>{t("employee.alreadyCheckedIn")}</p>
        )}

        {!punchStatusLoading && !canCheckIn && checkInNotice && !punchStatus?.isCheckedIn && (
          <p className={`${bannerInfo} mt-4`}>{checkInNotice}</p>
        )}

        {faceRecognitionEnabled === null && !punchStatusLoading && (
          <p className="text-[0.9375rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>
        )}

        {showFaceEnroll && (
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

        {showCheckIn && (
          <>
            <div className={`mt-4 ${segmentedWrap}`}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCheckInMode("normal")}
                className={segmentedBtn(checkInMode === "normal")}
              >
                {t("employee.checkInModeNormal")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setCheckInMode("businessTrip")}
                className={segmentedBtn(checkInMode === "businessTrip")}
              >
                {t("employee.checkInModeBusinessTrip")}
              </button>
            </div>

            {checkInMode === "businessTrip" && (
              <div className={`mt-4 space-y-3 border-t border-[var(--separator)] pt-4 ${bannerWarning}`}>
                <p className="!bg-transparent !p-0 text-[0.8125rem]">
                  {faceRequired ? t("employee.businessTripHint") : t("employee.businessTripHintNoFace")}
                </p>
                <label className={label}>
                  {t("employee.businessTripLocationLabel")}
                  <span className="text-[var(--apple-red)]"> *</span>
                </label>
                <input
                  type="text"
                  className={input}
                  value={businessTripLocation}
                  onChange={(e) => setBusinessTripLocation(e.target.value)}
                  placeholder={t("employee.businessTripLocationPlaceholder")}
                  maxLength={200}
                  disabled={busy}
                />
                <label className={label}>
                  {t("employee.businessTripReasonLabel")}
                  <span className="text-[var(--apple-red)]"> *</span>
                </label>
                <textarea
                  className={`${input} min-h-[5rem]`}
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
                  className={btnSuccessFull}
                >
                  {t("employee.checkInButton")}
                </button>
              </div>
            )}
          </>
        )}

        {readyForPunch && checkInMode === "normal" && (
          <>
            <div className="mt-4 border-t border-[var(--separator)] pt-4">
            <label className={label}>{t("employee.memoOptional")}</label>
            <textarea
              className={`${input} mt-1.5`}
              rows={2}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={t("employee.memoPlaceholder")}
            />
            </div>
          </>
        )}

        {showCheckIn && (
          <div className="mt-4 border-t border-[var(--separator)] pt-4">
            <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{t("employee.photoCheckInLabel")}</p>
            <p className={`mt-0.5 ${hint}`}>{t("employee.photoAttached")}</p>
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
                className={`mt-3 flex min-h-[2.75rem] w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--separator-opaque)] bg-[var(--grouped-bg)] py-2.5 text-sm font-medium text-[var(--foreground)] active:bg-[var(--fill-tertiary)] disabled:opacity-50`}
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
                  className="mx-auto max-h-40 w-full rounded-xl object-contain ring-1 ring-black/[0.06]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => photoInputRef.current?.click()}
                    className={`${btnSecondary} w-full py-2.5 text-[0.9375rem]`}
                  >
                    {t("employee.photoRetake")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={clearPhoto}
                    className={`${btnSecondary} w-full py-2.5 text-[0.9375rem] text-[var(--apple-red)]`}
                  >
                    {t("employee.photoRemove")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 border-t border-[var(--separator)] pt-4">
          <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{t("employee.locationMap")}</p>
          <p className={`mt-0.5 ${hint}`}>{t("employee.locationMapLead")}</p>
          <button
            type="button"
            disabled={busy || mapBusy}
            onClick={() => void loadMapPreview()}
            className={`mt-2 ${btnSecondary}`}
          >
            {mapBusy ? t("employee.readingLocation") : t("employee.showOnMap")}
          </button>
          {previewCoords && (
            <div className="mt-3">
              <StaticMap
                lat={previewCoords.lat}
                lng={previewCoords.lng}
                label={t("employee.currentLocation")}
                noKeyFallback="embed"
              />
              <p className="mt-1 break-all text-[0.6875rem] text-[var(--apple-label-tertiary)]">
                {previewCoords.lat.toFixed(6)}, {previewCoords.lng.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        {canCheckOut && !punchStatusLoading && (
          <div className="mt-6 border-t border-[var(--separator)] pt-5">
            {punchStatus?.earlyLeaveExpected && (
              <div className={`${bannerWarning} mb-3 space-y-2`}>
                <p className="!bg-transparent !p-0 text-[0.8125rem] font-semibold">
                  {punchStatus.workEndTime
                    ? t("employee.earlyLeaveNoticeWithTime").replace(
                        "{time}",
                        punchStatus.workEndTime
                      )
                    : t("employee.earlyLeaveNotice")}
                </p>
                <label className={label}>
                  {t("employee.earlyLeaveReasonLabel")}
                  <span className="text-[var(--apple-red)]"> *</span>
                </label>
                <textarea
                  className={`${input} min-h-[5rem]`}
                  rows={3}
                  value={earlyLeaveReason}
                  onChange={(e) => setEarlyLeaveReason(e.target.value)}
                  placeholder={t("employee.earlyLeaveReasonPlaceholder")}
                  maxLength={2000}
                  disabled={busy}
                />
              </div>
            )}
            {faceRequired ? (
              <FaceCapture
                mode="verify"
                disabled={
                  busy ||
                  (Boolean(punchStatus?.earlyLeaveExpected) && !earlyLeaveReason.trim())
                }
                onVerified={(descriptor) => void submitCheckOut(descriptor)}
                onError={setMsg}
              />
            ) : (
              <button
                type="button"
                disabled={
                  busy ||
                  (Boolean(punchStatus?.earlyLeaveExpected) && !earlyLeaveReason.trim())
                }
                onClick={() => void submitCheckOut()}
                className={btnPrimary + " w-full min-h-[3rem] py-3.5 text-[1.0625rem] sm:min-h-[3.25rem]"}
              >
                {punchStatus?.earlyLeaveExpected
                  ? t("employee.earlyLeaveSubmitButton")
                  : t("employee.checkOutOnly")}
              </button>
            )}
          </div>
        )}

        {msg && <p className={`mt-3 break-words text-center ${successText}`}>{msg}</p>}
        </div>
      </section>

      {showRecords && (
      <section>
        <p className="mb-2 px-1 text-[0.8125rem] font-semibold uppercase tracking-wide text-[var(--apple-label-secondary)]">
          {t("employee.recentRecords")}
        </p>
        <div className={tableWrap}>
          <table className={`${table} text-[0.875rem] sm:text-[0.9375rem]`}>
            <thead className={tableHead}>
              <tr>
                <th className={th}>{t("employee.recordsHeaderDate")}</th>
                <th className={th}>{t("employee.recordsHeaderCheckIn")}</th>
                <th className={th}>{t("employee.recordsHeaderCheckOut")}</th>
                <th className={`${th} hidden sm:table-cell`}>
                  {t("employee.recordsHeaderWorkHours")}
                </th>
                <th className={`${th} hidden md:table-cell`}>
                  {t("employee.recordsHeaderLocation")}
                </th>
                <th className={`${th} hidden sm:table-cell`}>
                  {t("employee.recordsHeaderFlags")}
                </th>
                <th className={`${th} text-right sm:text-left`}>
                  {t("employee.recordsHeaderStatus")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pairedRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-[0.875rem] text-[var(--apple-label-tertiary)] sm:px-6"
                  >
                    {t("employee.recordsEmpty")}
                  </td>
                </tr>
              ) : (
                pairedRecords.map((pair) => {
                  const anchor = pair.checkIn ?? pair.checkOut!;
                  const dateText = new Date(anchor.timestamp).toLocaleDateString(dateLocale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  });
                  const formatTime = (r: RecordRow) =>
                    new Date(r.timestamp).toLocaleTimeString(dateLocale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  const locationName = anchor.isBusinessTrip && anchor.businessTripLocation
                    ? `${t("employee.recordBusinessTrip")} ${anchor.businessTripLocation}`
                    : anchor.site?.name ?? null;
                  const distanceText =
                    anchor.site && anchor.distanceFromSite > 0
                      ? t("employee.recordDistance").replace(
                          "{m}",
                          String(Math.round(anchor.distanceFromSite))
                        )
                      : !anchor.site
                        ? `${anchor.latitude.toFixed(5)}, ${anchor.longitude.toFixed(5)}`
                        : null;
                  const status = pair.checkOut?.status ?? pair.checkIn?.status ?? "APPROVED";
                  const isLate = pair.checkIn?.isLate;
                  const lateMin = pair.checkIn?.lateMinutes ?? 0;
                  const isEarly = pair.checkOut?.isEarlyLeave;
                  const isOvertime = pair.checkOut?.isOvertime;
                  const overtimeMin = pair.checkOut?.overtimeMinutes ?? 0;
                  const isHoliday = pair.checkIn?.isHolidayWork ?? pair.checkOut?.isHolidayWork;
                  const trip = pair.checkIn?.isBusinessTrip ? pair.checkIn : null;
                  const exception = pair.checkOut?.exception ?? pair.checkIn?.exception ?? null;

                  // 근무 시간 — 출근/퇴근이 모두 있을 때만 산출
                  let workHoursText: string | null = null;
                  let workTotalMin: number | null = null;
                  if (pair.checkIn && pair.checkOut) {
                    const diffMs =
                      new Date(pair.checkOut.timestamp).getTime() -
                      new Date(pair.checkIn.timestamp).getTime();
                    workTotalMin = Math.max(0, Math.round(diffMs / 60000));
                    if (workTotalMin < 60) {
                      workHoursText = t("admin.attendanceDurationMinutes").replace(
                        "{n}",
                        String(workTotalMin)
                      );
                    } else {
                      const h = Math.floor(workTotalMin / 60);
                      const m = workTotalMin % 60;
                      workHoursText =
                        m === 0
                          ? t("admin.attendanceDurationHours").replace("{h}", String(h))
                          : t("admin.attendanceDurationHm")
                              .replace("{h}", String(h))
                              .replace("{m}", String(m));
                    }
                  }
                  const STANDARD_WORK_MIN = 9 * 60;
                  const isUnderHours =
                    workTotalMin !== null && workTotalMin < STANDARD_WORK_MIN;

                  return (
                    <tr key={pair.key} className={tableRow}>
                      <td className={`${td} whitespace-nowrap text-[var(--apple-label-secondary)]`}>
                        {dateText}
                      </td>
                      <td className={`${td} whitespace-nowrap font-semibold tabular-nums`}>
                        {pair.checkIn ? (
                          formatTime(pair.checkIn)
                        ) : (
                          <span className="font-normal text-[var(--apple-label-tertiary)]">—</span>
                        )}
                      </td>
                      <td className={`${td} whitespace-nowrap font-semibold tabular-nums`}>
                        {pair.checkOut ? (
                          formatTime(pair.checkOut)
                        ) : (
                          <span className="font-normal text-[var(--apple-label-tertiary)]">—</span>
                        )}
                      </td>
                      <td
                        className={`${td} hidden whitespace-nowrap font-medium tabular-nums sm:table-cell ${
                          isUnderHours ? "!text-[var(--apple-red)]" : ""
                        }`}
                        title={
                          isUnderHours ? t("admin.attendanceWorkUnderTooltip") : undefined
                        }
                      >
                        {workHoursText ? (
                          isUnderHours ? (
                            <span className="font-semibold text-[var(--apple-red)]">
                              {workHoursText}
                            </span>
                          ) : (
                            workHoursText
                          )
                        ) : (
                          <span className="font-normal text-[var(--apple-label-tertiary)]">—</span>
                        )}
                      </td>
                      <td className={`${td} hidden md:table-cell`}>
                        {locationName || distanceText ? (
                          <div className="flex flex-col leading-tight">
                            {locationName && (
                              <span className="text-[var(--foreground)]">{locationName}</span>
                            )}
                            {distanceText && (
                              <span className="text-[0.75rem] text-[var(--apple-label-tertiary)]">
                                {distanceText}
                              </span>
                            )}
                            {trip?.businessTripReason && (
                              <span className="text-[0.75rem] text-[var(--apple-label-tertiary)]">
                                {t("employee.recordReason")}: {trip.businessTripReason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--apple-label-tertiary)]">—</span>
                        )}
                      </td>
                      <td className={`${td} hidden text-[0.75rem] sm:table-cell`}>
                        <div className="flex flex-col gap-0.5 leading-tight">
                          {isHoliday && (
                            <span className="font-medium text-violet-700">
                              {t("employee.flagHolidayWork")}
                            </span>
                          )}
                          {isLate && (
                            <span className="font-medium text-amber-800">
                              {t("employee.flagLate")}
                              {lateMin > 0
                                ? ` ${lateMin}${t("employee.flagMinutes")}`
                                : ""}
                            </span>
                          )}
                          {isEarly && (
                            <span className="font-medium text-amber-800">
                              {t("employee.flagEarlyLeave")}
                            </span>
                          )}
                          {isOvertime && (
                            <span className="font-medium text-[var(--apple-blue)]">
                              {t("employee.flagOvertime")}
                              {overtimeMin > 0
                                ? ` ${overtimeMin}${t("employee.flagMinutes")}`
                                : ""}
                            </span>
                          )}
                          {exception && (
                            <span className="text-[var(--apple-label-tertiary)]">
                              {t("employee.recordException")}: {exception.status}
                            </span>
                          )}
                          {!isHoliday && !isLate && !isEarly && !isOvertime && !exception && (
                            <span className="text-[var(--apple-label-tertiary)]">—</span>
                          )}
                        </div>
                      </td>
                      <td className={`${td} whitespace-nowrap text-right sm:text-left`}>
                        <span className={statusBadge(status)}>{status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}
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
