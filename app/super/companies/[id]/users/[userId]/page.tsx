"use client";

import { AppleConfirmDialog } from "@/components/ui/AppleConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/components/LanguageProvider";
import { groupFaceCredentials, type FaceEnrollmentGroup } from "@/lib/faceEnrollmentGroups";
import { isStrongPassword } from "@/lib/passwordPolicy";
import {
  bannerSuccess,
  bannerWarning,
  btnDestructive,
  btnPrimaryLg,
  btnSecondary,
  cardBodyLg,
  errorText,
  groupedCardLg,
  hint,
  inputLg,
  labelLg,
  linkBackLg,
  pageStackDetailLg,
  sectionLabelLg,
} from "@/lib/uiStyles";
import { statusBadge } from "@/lib/statusBadge";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type UserDetail = {
  id: string;
  email: string;
  role: string;
  consentGivenAt: string | null;
  createdAt: string;
  employee: { id: string; name: string; faceEnrolledAt: string | null } | null;
};

type FaceCredentialItem = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  hasPreview: boolean;
  batchId: string | null;
};

type FaceDetail = {
  enrolled: boolean;
  faceRecognitionEnabled: boolean;
  enrollmentCount: number;
  maxEnrollments: number;
  credentials: FaceCredentialItem[];
};

export default function SuperUserDetailPage() {
  const { t, locale } = useI18n();
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";
  const params = useParams();
  const companyId = typeof params.id === "string" ? params.id : "";
  const userId = typeof params.userId === "string" ? params.userId : "";

  const [user, setUser] = useState<UserDetail | null>(null);
  const [face, setFace] = useState<FaceDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceMsg, setFaceMsg] = useState<string | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [deleteFaceTarget, setDeleteFaceTarget] = useState<FaceEnrollmentGroup | "all" | null>(
    null
  );

  const load = useCallback(async () => {
    if (!companyId || !userId) return;
    setLoadError(null);
    const r = await fetch(`/api/super/companies/${companyId}/users/${userId}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setUser(null);
      setFace(null);
      setLoadError(typeof j.error === "string" ? j.error : t("super.userDetailLoadFail"));
      return;
    }
    setUser(j.user ?? null);
    setFace(j.face ?? null);
  }, [companyId, userId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const faceGroups = useMemo(
    () => (face?.credentials ? groupFaceCredentials(face.credentials) : []),
    [face?.credentials]
  );

  function roleLabel(r: string) {
    switch (r) {
      case "COMPANY_ADMIN":
        return t("super.roleCompanyAdmin");
      case "HR_MANAGER":
        return t("super.roleHr");
      case "APPROVER":
        return t("super.roleApprover");
      case "EMPLOYEE":
        return t("super.roleEmployee");
      case "DOOR":
        return t("common.roleDoor");
      default:
        return r;
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordMsg(null);
    if (!isStrongPassword(password)) {
      setPasswordError(t("account.errMinLength"));
      return;
    }
    setPasswordBusy(true);
    const r = await fetch(`/api/super/companies/${companyId}/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const j = await r.json().catch(() => ({}));
    setPasswordBusy(false);
    if (!r.ok) {
      setPasswordError(typeof j.error === "string" ? j.error : t("super.userPasswordFail"));
      return;
    }
    setPassword("");
    setPasswordMsg(t("super.userPasswordOk"));
  }

  async function confirmDeleteFace() {
    if (!deleteFaceTarget) return;
    setFaceError(null);
    setFaceMsg(null);
    setFaceBusy(true);
    const body =
      deleteFaceTarget === "all"
        ? { all: true }
        : deleteFaceTarget.batchId
          ? { batchId: deleteFaceTarget.batchId }
          : { batchId: deleteFaceTarget.key };
    const r = await fetch(`/api/super/companies/${companyId}/users/${userId}/face`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setFaceBusy(false);
    if (!r.ok) {
      setFaceError(typeof j.error === "string" ? j.error : t("super.userFaceDeleteFail"));
      return;
    }
    setDeleteFaceTarget(null);
    setFaceMsg(t("super.userFaceDeleteOk"));
    await load();
  }

  if (!companyId || !userId) return null;

  if (!user) {
    return (
      <div className={pageStackDetailLg}>
        <Link href={`/super/companies/${companyId}`} className={linkBackLg}>
          ← {t("super.backToUserList")}
        </Link>
        <p className="text-[1rem] text-[var(--apple-label-secondary)] sm:text-[1.0625rem]">
          {loadError ?? t("super.userDetailLoadFail")}
        </p>
      </div>
    );
  }

  return (
    <div className={pageStackDetailLg}>
      <PageHeader
        size="lg"
        title={user.employee?.name ?? user.email}
        subtitle={user.email}
        meta={roleLabel(user.role)}
        actions={
          <Link href={`/super/companies/${companyId}`} className={linkBackLg}>
            ← {t("super.backToUserList")}
          </Link>
        }
      />

      <section>
        <p className={sectionLabelLg}>{t("super.userDetailSection")}</p>
        <div className={groupedCardLg}>
          <div className={`${cardBodyLg} grid gap-4 sm:grid-cols-2`}>
            <div>
              <p className={labelLg}>{t("super.listEmail")}</p>
              <p className="mt-1 text-[0.9375rem]">{user.email}</p>
            </div>
            <div>
              <p className={labelLg}>{t("super.listName")}</p>
              <p className="mt-1 text-[0.9375rem]">{user.employee?.name ?? "—"}</p>
            </div>
            <div>
              <p className={labelLg}>{t("super.listRole")}</p>
              <p className="mt-1 text-[0.9375rem]">{roleLabel(user.role)}</p>
            </div>
            <div>
              <p className={labelLg}>{t("super.listConsent")}</p>
              <p className="mt-1">
                <span className={statusBadge(user.consentGivenAt ? "APPROVED" : "PENDING")}>
                  {user.consentGivenAt ? t("super.consentDone") : t("super.consentPending")}
                </span>
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className={labelLg}>{t("super.userCreatedAt")}</p>
              <p className="mt-1 text-[0.9375rem] tabular-nums">
                {new Date(user.createdAt).toLocaleString(dateLocale)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className={sectionLabelLg}>{t("super.userPasswordSection")}</p>
        <div className={groupedCardLg}>
          <div className={cardBodyLg}>
            <form onSubmit={(e) => void savePassword(e)} className="space-y-4">
              <div>
                <label className={labelLg} htmlFor="super-user-new-password">
                  {t("super.userPasswordLabel")}
                </label>
                <input
                  id="super-user-new-password"
                  type="password"
                  autoComplete="new-password"
                  className={`${inputLg} mt-1.5`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={passwordBusy}
                />
                <p className={`${hint} mt-1.5`}>{t("account.passwordHint")}</p>
              </div>
              {passwordError && <p className={errorText}>{passwordError}</p>}
              {passwordMsg && <p className={bannerSuccess}>{passwordMsg}</p>}
              <button type="submit" className={btnPrimaryLg} disabled={passwordBusy}>
                {passwordBusy ? t("common.processing") : t("super.userPasswordSave")}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section>
        <p className={sectionLabelLg}>{t("super.userFaceSection")}</p>
        <div className={groupedCardLg}>
          <div className={cardBodyLg}>
            {!user.employee ? (
              <p className={hint}>{t("super.userFaceNoEmployee")}</p>
            ) : !face?.faceRecognitionEnabled ? (
              <p className={hint}>{t("super.userFaceDisabled")}</p>
            ) : !face.enrolled ? (
              <p className={hint}>{t("super.userFaceEmpty")}</p>
            ) : (
              <div className="space-y-4">
                <p className={hint}>
                  {t("super.userFaceCount")
                    .replace("{n}", String(face.enrollmentCount))
                    .replace("{max}", String(face.maxEnrollments))}
                </p>
                <ul className="space-y-2">
                  {faceGroups.map((group, index) => (
                    <li
                      key={group.key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--separator)] px-4 py-3"
                    >
                      <div>
                        <p className="text-[0.9375rem] font-medium">
                          {t("super.userFaceEnrollment").replace("{n}", String(index + 1))}
                        </p>
                        <p className="mt-0.5 text-[0.8125rem] text-[var(--apple-label-secondary)] tabular-nums">
                          {new Date(group.createdAt).toLocaleString(dateLocale)}
                          {group.sampleCount > 1
                            ? ` · ${t("super.userFaceSamples").replace("{n}", String(group.sampleCount))}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={btnDestructive}
                        disabled={faceBusy}
                        onClick={() => setDeleteFaceTarget(group)}
                      >
                        {t("super.userFaceDeleteOne")}
                      </button>
                    </li>
                  ))}
                </ul>
                {faceGroups.length > 1 ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={faceBusy}
                    onClick={() => setDeleteFaceTarget("all")}
                  >
                    {t("super.userFaceDeleteAll")}
                  </button>
                ) : null}
              </div>
            )}
            {faceError && <p className={`mt-3 ${errorText}`}>{faceError}</p>}
            {faceMsg && <p className={`mt-3 ${bannerSuccess}`}>{faceMsg}</p>}
          </div>
        </div>
      </section>

      <AppleConfirmDialog
        open={deleteFaceTarget !== null}
        title={t("super.userFaceDeleteConfirmTitle")}
        message={
          deleteFaceTarget === "all"
            ? t("super.userFaceDeleteAllConfirm")
            : t("super.userFaceDeleteOneConfirm")
        }
        confirmLabel={t("super.userFaceDeleteOne")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={faceBusy}
        onConfirm={() => void confirmDeleteFace()}
        onCancel={() => {
          if (faceBusy) return;
          setDeleteFaceTarget(null);
        }}
      />
    </div>
  );
}
