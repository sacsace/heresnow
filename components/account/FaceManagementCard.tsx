"use client";

import { FacePreviewModal } from "@/components/account/FacePreviewModal";
import { FaceCapture } from "@/components/employee/FaceCapture";
import { FaceEnrollmentCapture } from "@/components/employee/FaceEnrollmentCapture";
import { useI18n } from "@/components/LanguageProvider";
import { AppleConfirmDialog } from "@/components/ui/AppleConfirmDialog";
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
import { useCallback, useEffect, useMemo, useState } from "react";

type FaceCredentialItem = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  hasPreview: boolean;
  batchId?: string | null;
};

type FaceEnrollmentGroup = {
  key: string;
  batchId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  hasPreview: boolean;
  previewCredentialId: string | null;
  sampleCount: number;
};

function groupFaceCredentials(items: FaceCredentialItem[]): FaceEnrollmentGroup[] {
  const map = new Map<string, FaceEnrollmentGroup>();
  for (const item of items) {
    const key = item.batchId ?? item.id;
    const existing = map.get(key);
    if (existing) {
      existing.sampleCount += 1;
      if (item.hasPreview) {
        existing.hasPreview = true;
        existing.previewCredentialId = item.id;
      }
      if (
        item.lastUsedAt &&
        (!existing.lastUsedAt || item.lastUsedAt > existing.lastUsedAt)
      ) {
        existing.lastUsedAt = item.lastUsedAt;
      }
    } else {
      map.set(key, {
        key,
        batchId: item.batchId ?? null,
        createdAt: item.createdAt,
        lastUsedAt: item.lastUsedAt,
        hasPreview: item.hasPreview,
        previewCredentialId: item.hasPreview ? item.id : null,
        sampleCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

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
  const [deleteTarget, setDeleteTarget] = useState<FaceEnrollmentGroup | null>(null);

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

  async function confirmDeleteEnrollment() {
    if (!deleteTarget) return;
    const group = deleteTarget;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/employee/face", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          group.batchId ? { batchId: group.batchId } : { id: group.key }
        ),
      });
      if (!r.ok) {
        setError(t("account.faceDeleteFail"));
        return;
      }
      setDeleteTarget(null);
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

  const enrollmentGroups = useMemo(
    () => groupFaceCredentials(status?.credentials ?? []),
    [status?.credentials]
  );

  if (!loading && status === null && !error) {
    return null;
  }

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

            {enrollmentGroups.length === 0 ? (
              <p className={hint}>{t("account.faceNone")}</p>
            ) : (
              <div className="space-y-2">
                {enrollmentGroups.map((group, index) => (
                  <div
                    key={group.key}
                    className="rounded-xl border border-[var(--separator)] bg-[var(--fill-tertiary)] px-3 py-2.5"
                  >
                    <p className="text-[0.8125rem] font-semibold text-[var(--foreground)]">
                      {t("account.faceCredentialLabel").replace("{n}", String(index + 1))}
                    </p>
                    <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
                      {t("account.faceCredentialCreated").replace(
                        "{time}",
                        new Date(group.createdAt).toLocaleString()
                      )}
                    </p>
                    {group.sampleCount > 1 ? (
                      <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
                        {t("account.faceCredentialSamples").replace(
                          "{count}",
                          String(group.sampleCount)
                        )}
                      </p>
                    ) : null}
                    {group.lastUsedAt ? (
                      <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
                        {t("account.faceCredentialLastUsed").replace(
                          "{time}",
                          new Date(group.lastUsedAt).toLocaleString()
                        )}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.hasPreview && group.previewCredentialId ? (
                        <button
                          type="button"
                          className={`${btnSecondary} h-8 px-3 text-[0.75rem]`}
                          onClick={() => {
                            setError(null);
                            setSuccess(null);
                            setPreviewCredentialId(group.previewCredentialId);
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
                        onClick={() => setDeleteTarget(group)}
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
              <FaceEnrollmentCapture
                title={t("account.faceEnrollCaptureTitle")}
                onEnrolled={() => {
                  setEnrolling(false);
                  setSuccess(t("account.faceEnrollOk"));
                  void load();
                }}
                onError={(msg) => setError(msg)}
                onCancel={() => {
                  setEnrolling(false);
                  setError(null);
                }}
              />
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
                {enrollmentGroups.length > 0 ? (
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
                  {enrollmentGroups.length > 0
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
            ? status?.credentials.find((c) => c.id === previewCredentialId)?.hasPreview
            : status?.hasPreview
        )}
        credentialId={previewCredentialId}
      />

      <AppleConfirmDialog
        open={deleteTarget != null}
        title={t("account.faceDeleteConfirmTitle")}
        message={t("account.faceDeleteConfirmMessage")}
        confirmLabel={t("account.faceDeleteConfirmAction")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={busy}
        onConfirm={() => void confirmDeleteEnrollment()}
        onCancel={() => {
          if (!busy) setDeleteTarget(null);
        }}
      />
    </section>
  );
}
