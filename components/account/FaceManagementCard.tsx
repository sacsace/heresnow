"use client";

import { FacePreviewModal } from "@/components/account/FacePreviewModal";
import { FaceCapture } from "@/components/employee/FaceCapture";
import { useI18n } from "@/components/LanguageProvider";
import {
  bannerInfo,
  bannerSuccess,
  btnActionEqual,
  btnPrimary,
  btnSecondary,
  card,
  cardBody,
  cardHeader,
  errorText,
  hint,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

type FaceCredentialItem = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  hasPreview: boolean;
};

type FaceStatus = {
  enrolled: boolean;
  enrolledAt: string | null;
  hasPreview: boolean;
  faceRecognitionEnabled: boolean;
  credentials: FaceCredentialItem[];
};

export function FaceManagementCard() {
  const { t } = useI18n();
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [testingFace, setTestingFace] = useState(false);
  const [previewCredentialId, setPreviewCredentialId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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
      const j = (await r.json().catch(() => ({}))) as Partial<FaceStatus> & {
        credentials?: FaceCredentialItem[];
      };
      if (r.ok) {
        setStatus({
          enrolled: Boolean(j.enrolled),
          enrolledAt: j.enrolledAt ?? null,
          hasPreview: Boolean(j.hasPreview),
          faceRecognitionEnabled: Boolean(j.faceRecognitionEnabled),
          credentials: Array.isArray(j.credentials) ? j.credentials : [],
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

  async function deleteCredential(id: string) {
    if (!window.confirm(t("account.faceDeleteConfirm"))) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/employee/face", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) {
        setError(t("account.faceDeleteFail"));
        return;
      }
      setSuccess(t("account.faceDeleted"));
      await load();
    } catch {
      setError(t("account.faceDeleteFail"));
    } finally {
      setBusy(false);
    }
  }

  function formatTestResult(matched: boolean, confidencePercent: number): string {
    const key = matched ? "account.faceTestOkPercent" : "account.faceTestFailPercent";
    return t(key).replace("{percent}", String(confidencePercent));
  }

  if (!loading && status === null && !error) {
    return null;
  }

  const credentials = status?.credentials ?? [];

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
        ) : error && !status ? (
          <p className={errorText}>{error}</p>
        ) : status && !status.faceRecognitionEnabled ? (
          <p className={bannerInfo}>{t("account.faceDisabledNote")}</p>
        ) : status ? (
          <>
            {error ? <p className={errorText}>{error}</p> : null}
            {success ? <p className={bannerSuccess}>{success}</p> : null}

            {credentials.length === 0 ? (
              <p className={hint}>{t("account.faceNone")}</p>
            ) : (
              <div className="space-y-2">
                {credentials.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[var(--separator)] bg-[var(--fill-tertiary)] px-3 py-2.5"
                  >
                    <p className="text-[0.8125rem] font-semibold text-[var(--foreground)]">
                      {t("account.faceCredentialLabel").replace("{n}", String(index + 1))}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
                      {t("account.faceCredentialCreated").replace(
                        "{time}",
                        new Date(item.createdAt).toLocaleString()
                      )}
                    </p>
                    {item.lastUsedAt ? (
                      <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
                        {t("account.faceCredentialLastUsed").replace(
                          "{time}",
                          new Date(item.lastUsedAt).toLocaleString()
                        )}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.hasPreview ? (
                        <button
                          type="button"
                          className={`${btnSecondary} h-8 px-3 text-[0.75rem]`}
                          onClick={() => {
                            setError(null);
                            setSuccess(null);
                            setPreviewCredentialId(item.id);
                            setPreviewOpen(true);
                          }}
                          disabled={busy}
                        >
                          {t("account.faceViewButton")}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`${btnSecondary} h-8 px-3 text-[0.75rem]`}
                        onClick={() => void deleteCredential(item.id)}
                        disabled={busy}
                      >
                        {t("account.faceDelete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {enrolling ? (
              <div className="space-y-3">
                <FaceCapture
                  mode="enroll"
                  profileKind="login"
                  onEnrolled={() => {
                    setEnrolling(false);
                    setSuccess(t("account.faceEnrollOk"));
                    void load();
                  }}
                  onError={(msg) => setError(msg)}
                />
                <button
                  type="button"
                  className={`${btnSecondary} ${btnActionEqual}`}
                  onClick={() => {
                    setEnrolling(false);
                    setError(null);
                  }}
                >
                  {t("account.faceCancelReEnroll")}
                </button>
              </div>
            ) : testingFace ? (
              <div className="space-y-3">
                <FaceCapture
                  mode="verify"
                  profileKind="login"
                  verifyOnClientOnly
                  verifyTitle={t("account.faceTestButton")}
                  verifyLead={t("account.faceTestLead")}
                  onVerified={async (descriptor) => {
                    const r = await fetch("/api/employee/face", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ descriptor }),
                    });
                    const j = (await r.json().catch(() => ({}))) as {
                      confidencePercent?: number;
                    };
                    const percent =
                      typeof j.confidencePercent === "number" ? j.confidencePercent : 0;
                    if (r.ok) {
                      setTestingFace(false);
                      setError(null);
                      setSuccess(formatTestResult(true, percent));
                      return true;
                    }
                    setSuccess(null);
                    setError(formatTestResult(false, percent));
                    return false;
                  }}
                  onError={(msg) => setError(msg)}
                />
                <button
                  type="button"
                  className={`${btnSecondary} ${btnActionEqual}`}
                  onClick={() => {
                    setTestingFace(false);
                    setError(null);
                  }}
                >
                  {t("account.faceCancelTest")}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {credentials.length > 0 ? (
                  <button
                    type="button"
                    className={`${btnSecondary} ${btnActionEqual} sm:max-w-xs`}
                    onClick={() => {
                      setError(null);
                      setSuccess(null);
                      setTestingFace(true);
                    }}
                    disabled={busy}
                  >
                    {t("account.faceTestButton")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${btnPrimary} ${btnActionEqual} sm:max-w-xs`}
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setEnrolling(true);
                  }}
                  disabled={busy}
                >
                  {credentials.length > 0
                    ? t("account.faceAddButton")
                    : t("account.faceEnrollFirstButton")}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>

      <FacePreviewModal
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewCredentialId(null);
        }}
        hasPreview={Boolean(
          previewCredentialId
            ? credentials.find((c) => c.id === previewCredentialId)?.hasPreview
            : status?.hasPreview
        )}
        credentialId={previewCredentialId}
      />
    </section>
  );
}
