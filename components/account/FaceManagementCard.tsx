"use client";

import { FaceCapture } from "@/components/employee/FaceCapture";
import { useI18n } from "@/components/LanguageProvider";
import {
  bannerInfo,
  bannerSuccess,
  btnPrimary,
  btnSecondary,
  card,
  cardBody,
  cardHeader,
  errorText,
  hint,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

type FaceStatus = {
  enrolled: boolean;
  enrolledAt: string | null;
  faceRecognitionEnabled: boolean;
};

export function FaceManagementCard() {
  const { t } = useI18n();
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reEnrolling, setReEnrolling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/employee/face");
      if (r.status === 401 || r.status === 403) {
        setStatus(null);
        setError(null);
        setLoading(false);
        return;
      }
      const j = (await r.json().catch(() => ({}))) as Partial<FaceStatus>;
      if (r.ok) {
        setStatus({
          enrolled: Boolean(j.enrolled),
          enrolledAt: j.enrolledAt ?? null,
          faceRecognitionEnabled: Boolean(j.faceRecognitionEnabled),
        });
      } else {
        setError(t("account.faceLoadFail"));
      }
    } catch {
      setError(t("account.faceLoadFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // employeeId 없는 사용자(예: 플랫폼 SUPER_ADMIN) 또는 인증 없음 → 섹션 자체 비표시
  if (!loading && status === null && !error) {
    return null;
  }

  const enrolledLabel = status?.enrolled
    ? t("account.faceStatusEnrolled")
    : t("account.faceStatusNotEnrolled");
  const enrolledAt = status?.enrolledAt
    ? new Date(status.enrolledAt).toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <section className={card}>
      <div className={cardHeader}>
        <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">
          {t("account.faceTitle")}
        </p>
        <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
          {t("account.faceLead")}
        </p>
      </div>
      <div className={`${cardBody} space-y-4`}>
        {loading ? (
          <p className={hint}>{t("common.loading")}</p>
        ) : error ? (
          <p className={errorText}>{error}</p>
        ) : status && !status.faceRecognitionEnabled ? (
          <p className={bannerInfo}>{t("account.faceDisabledNote")}</p>
        ) : status ? (
          <>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--apple-label-secondary)]">
                  {t("account.faceTitle")}
                </p>
                <p
                  className={`mt-1 text-[0.9375rem] font-semibold ${
                    status.enrolled
                      ? "text-[var(--apple-green-dark)]"
                      : "text-[var(--apple-orange-dark)]"
                  }`}
                >
                  {enrolledLabel}
                </p>
              </div>
              {enrolledAt && (
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--apple-label-secondary)]">
                    {t("account.faceEnrolledAtLabel")}
                  </p>
                  <p className="mt-1 text-[0.875rem] text-[var(--foreground)]">{enrolledAt}</p>
                </div>
              )}
            </div>

            {success && <p className={bannerSuccess}>{success}</p>}

            {reEnrolling ? (
              <div className="space-y-3">
                <FaceCapture
                  mode="enroll"
                  onEnrolled={() => {
                    setReEnrolling(false);
                    setSuccess(t("account.faceReEnrollOk"));
                    void load();
                  }}
                  onError={(msg) => setError(msg)}
                />
                <button
                  type="button"
                  className={`${btnSecondary} w-full sm:w-auto`}
                  onClick={() => {
                    setReEnrolling(false);
                    setError(null);
                  }}
                >
                  {t("account.faceCancelReEnroll")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`${btnPrimary} w-full sm:w-auto`}
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setReEnrolling(true);
                }}
              >
                {status.enrolled
                  ? t("account.faceReEnrollButton")
                  : t("account.faceEnrollFirstButton")}
              </button>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
