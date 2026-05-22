"use client";

import { useI18n } from "@/components/LanguageProvider";
import { WEEKDAY_LABELS_KO } from "@/lib/companyWorkSchedule";
import { useCallback, useEffect, useState } from "react";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

type Settings = {
  faceRecognitionEnabled: boolean;
  workStartTime: string | null;
  workEndTime: string | null;
  workDaysArray: number[];
  canEdit: boolean;
};

export function AdminCompanySettings() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [workDaySet, setWorkDaySet] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await fetch("/api/admin/settings");
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      setSettings(null);
      setError(typeof j.error === "string" ? j.error : t("admin.settingsLoadFail"));
      return;
    }
    const s = j as Settings & {
      workStartTime?: string | null;
      workEndTime?: string | null;
      faceRecognitionEnabled?: boolean;
    };
    setSettings({
      faceRecognitionEnabled: Boolean(s.faceRecognitionEnabled),
      workStartTime: s.workStartTime ?? "09:00",
      workEndTime: s.workEndTime ?? "18:00",
      workDaysArray: s.workDaysArray ?? [1, 2, 3, 4, 5],
      canEdit: Boolean(s.canEdit),
    });
    setWorkStart(s.workStartTime ?? "09:00");
    setWorkEnd(s.workEndTime ?? "18:00");
    setWorkDaySet(new Set(s.workDaysArray ?? [1, 2, 3, 4, 5]));
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(body: Record<string, unknown>) {
    if (!settings?.canEdit || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const r = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      const err = j.error as { fieldErrors?: Record<string, string[]> } | string | undefined;
      if (typeof err === "string") setError(err);
      else if (err?.fieldErrors?.workEndTime?.[0]) setError(err.fieldErrors.workEndTime[0]);
      else setError(t("admin.settingsSaveFail"));
      return;
    }
    await load();
    setSaved(true);
  }

  function toggleDay(day: number) {
    setWorkDaySet((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        if (next.size <= 1) return prev;
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  async function saveWorkSchedule() {
    await patch({
      workStartTime: workStart,
      workEndTime: workEnd,
      workDays: [...workDaySet].sort((a, b) => a - b).join(","),
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-zinc-200/80 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-zinc-900">{t("admin.settingsTitle")}</h2>
      <p className="mt-1 text-sm text-zinc-500">{t("admin.settingsLead")}</p>

      {loading && <p className="mt-4 text-sm text-zinc-500">{t("common.loading")}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mt-4 text-sm text-emerald-700">{t("admin.settingsSaved")}</p>
      )}

      {!loading && settings && (
        <div className="mt-4 space-y-6">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 sm:items-center">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-zinc-300 text-sky-600 focus:ring-sky-500 disabled:opacity-50 sm:mt-0"
              checked={settings.faceRecognitionEnabled}
              disabled={!settings.canEdit || saving}
              onChange={(e) => void patch({ faceRecognitionEnabled: e.target.checked })}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-900">
                {t("admin.settingsFaceRecognition")}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {settings.faceRecognitionEnabled
                  ? t("admin.settingsFaceOnHint")
                  : t("admin.settingsFaceOffHint")}
              </span>
            </span>
          </label>

          <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 sm:p-4">
            <h3 className="text-sm font-semibold text-zinc-900">{t("admin.settingsWorkTitle")}</h3>
            <p className="mt-1 text-xs text-zinc-500">{t("admin.settingsWorkLead")}</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">{t("admin.settingsWorkStart")}</span>
                <input
                  type="time"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
                  value={workStart}
                  disabled={!settings.canEdit || saving}
                  onChange={(e) => setWorkStart(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-zinc-700">{t("admin.settingsWorkEnd")}</span>
                <input
                  type="time"
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
                  value={workEnd}
                  disabled={!settings.canEdit || saving}
                  onChange={(e) => setWorkEnd(e.target.value)}
                />
              </label>
            </div>

            <p className="mt-4 text-sm font-medium text-zinc-700">{t("admin.settingsWorkDays")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!settings.canEdit || saving}
                  onClick={() => toggleDay(d)}
                  className={`min-w-[2.5rem] rounded-lg border px-3 py-2 text-sm font-medium touch-manipulation ${
                    workDaySet.has(d)
                      ? "border-sky-300 bg-sky-50 text-sky-800"
                      : "border-zinc-200 bg-white text-zinc-500"
                  } disabled:opacity-50`}
                >
                  {WEEKDAY_LABELS_KO[d]}
                </button>
              ))}
            </div>

            <ul className="mt-3 list-inside list-disc text-xs text-zinc-500">
              <li>{t("admin.settingsWorkRuleLate")}</li>
              <li>{t("admin.settingsWorkRuleEarly")}</li>
              <li>{t("admin.settingsWorkRuleOvertime")}</li>
              <li>{t("admin.settingsWorkRuleHoliday")}</li>
            </ul>

            {settings.canEdit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveWorkSchedule()}
                className="mt-4 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {saving ? t("common.processing") : t("admin.settingsSaveWork")}
              </button>
            )}
          </div>
        </div>
      )}

      {settings && !settings.canEdit && !loading && !error && (
        <p className="mt-2 text-xs text-zinc-400">{t("admin.settingsReadOnly")}</p>
      )}
    </section>
  );
}
