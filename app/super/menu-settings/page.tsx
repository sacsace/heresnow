"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/components/LanguageProvider";
import {
  bodySection,
  btnPrimary,
  btnSecondary,
  errorText,
  filterCheckboxLabel,
  groupedCard,
  hintBox,
  pageStackDetail,
} from "@/lib/uiStyles";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type Flags = {
  showWorkRequestsMenu: boolean;
  showBillingMenu: boolean;
};

export default function SuperMenuSettingsPage() {
  const { t } = useI18n();
  const { data: session, status } = useSession();
  const isRoot =
    session?.user?.role === "SUPER_ADMIN" &&
    (session.user.email ?? "").trim().toLowerCase() === "root";

  const [flags, setFlags] = useState<Flags | null>(null);
  const [draft, setDraft] = useState<Flags | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [embedConfigured, setEmbedConfigured] = useState<boolean | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, emb] = await Promise.all([
        fetch("/api/super/platform-settings"),
        fetch("/api/super/face-embed/backfill"),
      ]);
      if (!r.ok) {
        setError(t("super.menuSettingsForbidden"));
        setFlags(null);
        setDraft(null);
        return;
      }
      const j = (await r.json()) as Flags;
      setFlags(j);
      setDraft(j);
      if (emb.ok) {
        const ej = (await emb.json()) as { configured?: boolean };
        setEmbedConfigured(Boolean(ej.configured));
      } else {
        setEmbedConfigured(false);
      }
    } catch {
      setError(t("super.menuSettingsLoadFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch("/api/super/platform-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!r.ok) {
        setError(t("super.menuSettingsSaveFail"));
        return;
      }
      const j = (await r.json()) as Flags;
      setFlags(j);
      setDraft(j);
      setSaved(true);
    } catch {
      setError(t("super.menuSettingsSaveFail"));
    } finally {
      setSaving(false);
    }
  }

  async function runBackfill() {
    setBackfillBusy(true);
    setBackfillMsg(null);
    try {
      const r = await fetch("/api/super/face-embed/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 40 }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        processed?: number;
        updated?: number;
        skipped?: number;
        message?: string;
      };
      if (!r.ok) {
        setBackfillMsg(j.message ?? t("super.faceEmbedBackfillFail"));
        return;
      }
      setBackfillMsg(
        t("super.faceEmbedBackfillOk")
          .replace("{processed}", String(j.processed ?? 0))
          .replace("{updated}", String(j.updated ?? 0))
          .replace("{skipped}", String(j.skipped ?? 0))
      );
    } catch {
      setBackfillMsg(t("super.faceEmbedBackfillFail"));
    } finally {
      setBackfillBusy(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className={pageStackDetail}>
        <PageHeader title={t("super.menuSettingsTitle")} />
        <p className="text-sm text-[var(--apple-label-secondary)]">{t("common.loading")}</p>
      </div>
    );
  }

  if (!isRoot) {
    return (
      <div className={pageStackDetail}>
        <PageHeader title={t("super.menuSettingsTitle")} />
        <p className={errorText}>{t("super.menuSettingsForbidden")}</p>
      </div>
    );
  }

  return (
    <div className={pageStackDetail}>
      <PageHeader
        title={t("super.menuSettingsTitle")}
        subtitle={t("super.menuSettingsLead")}
      />

      <div className={`${bodySection} ${groupedCard} space-y-4 p-4`}>
        <p className={hintBox}>{t("super.menuSettingsHint")}</p>

        {draft ? (
          <div className="space-y-3">
            <label className={filterCheckboxLabel}>
              <input
                type="checkbox"
                checked={draft.showWorkRequestsMenu}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, showWorkRequestsMenu: e.target.checked } : d
                  )
                }
              />
              <span>{t("super.menuSettingsWorkRequests")}</span>
            </label>
            <label className={filterCheckboxLabel}>
              <input
                type="checkbox"
                checked={draft.showBillingMenu}
                onChange={(e) =>
                  setDraft((d) =>
                    d ? { ...d, showBillingMenu: e.target.checked } : d
                  )
                }
              />
              <span>{t("super.menuSettingsBilling")}</span>
            </label>
          </div>
        ) : null}

        {error ? <p className={errorText}>{error}</p> : null}
        {saved ? (
          <p className="text-sm text-[var(--apple-green)]">{t("super.menuSettingsSaved")}</p>
        ) : null}

        <button
          type="button"
          className={btnPrimary}
          disabled={
            saving ||
            !draft ||
            !flags ||
            (draft.showWorkRequestsMenu === flags.showWorkRequestsMenu &&
              draft.showBillingMenu === flags.showBillingMenu)
          }
          onClick={() => void save()}
        >
          {saving ? t("common.processing") : t("super.menuSettingsSave")}
        </button>
      </div>

      <div className={`${bodySection} ${groupedCard} mt-4 space-y-3 p-4`}>
        <p className="text-sm font-semibold text-[var(--foreground)]">{t("super.faceEmbedTitle")}</p>
        <p className={hintBox}>{t("super.faceEmbedLead")}</p>
        <p className="text-sm text-[var(--apple-label-secondary)]">
          {embedConfigured
            ? t("super.faceEmbedConfigured")
            : t("super.faceEmbedNotConfigured")}
        </p>
        <button
          type="button"
          className={btnSecondary}
          disabled={!embedConfigured || backfillBusy}
          onClick={() => void runBackfill()}
        >
          {backfillBusy ? t("common.processing") : t("super.faceEmbedBackfill")}
        </button>
        {backfillMsg ? (
          <p className="text-sm text-[var(--apple-label-secondary)]">{backfillMsg}</p>
        ) : null}
      </div>
    </div>
  );
}
