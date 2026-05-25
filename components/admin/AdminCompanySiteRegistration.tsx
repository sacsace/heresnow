"use client";

import { StaticMap } from "@/components/admin/StaticMap";
import { useI18n } from "@/components/LanguageProvider";
import { DEFAULT_SITE_RADIUS_M } from "@/lib/siteGeofence";
import {
  btnPrimary,
  btnSecondary,
  errorText,
  groupedCard,
  hint,
  input,
  label,
  sectionLabel,
  successText,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

type SiteRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowedRadius: number;
};

export function AdminCompanySiteRegistration() {
  const { t } = useI18n();
  const [site, setSite] = useState<SiteRow | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [name, setName] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await fetch("/api/admin/site");
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      setSite(null);
      setError(typeof j.error === "string" ? j.error : t("admin.siteLoadFail"));
      return;
    }
    const row = (j as { site?: SiteRow | null }).site ?? null;
    setSite(row);
    setCanEdit(Boolean((j as { canEdit?: boolean }).canEdit));
    if (row) {
      setName(row.name);
      setCoords({ lat: row.latitude, lng: row.longitude });
    } else {
      setName(t("admin.siteDefaultName"));
      setCoords(null);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function readPositionOnce(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error(t("admin.siteGeoUnsupported")));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      });
    });
  }

  async function captureCurrentLocation() {
    if (!canEdit || locating) return;
    setLocating(true);
    setError(null);
    setSaved(false);
    try {
      const pos = await readPositionOnce();
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : t("admin.siteGeoFail");
      setError(msg);
    }
    setLocating(false);
  }

  async function saveSite() {
    if (!canEdit || saving) return;
    if (!name.trim()) {
      setError(t("admin.siteNameRequired"));
      return;
    }
    if (!coords) {
      setError(t("admin.siteCoordsRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const r = await fetch("/api/admin/site", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
        allowedRadius: DEFAULT_SITE_RADIUS_M,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) {
      const err = j.error as string | { fieldErrors?: Record<string, string[]> } | undefined;
      if (typeof err === "string") setError(err);
      else setError(t("admin.siteSaveFail"));
      return;
    }
    setSaved(true);
    await load();
  }

  const displayCoords = coords ?? (site ? { lat: site.latitude, lng: site.longitude } : null);

  return (
    <section>
      <p className={sectionLabel}>{t("admin.siteTitle")}</p>
      <div className={groupedCard}>
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <p className="text-[0.9375rem] leading-relaxed text-[var(--apple-label-secondary)]">
            {t("admin.siteLead")}
          </p>

          {loading ? (
            <p className={`mt-4 text-[0.875rem] ${hint}`}>{t("common.loading")}</p>
          ) : (
            <>
              {site && (
                <p className="mt-3 text-[0.8125rem] text-[var(--apple-label-secondary)]">
                  {t("admin.siteRegisteredHint")}
                </p>
              )}

              <div className="mt-4 space-y-4">
                <div>
                  <label className={label} htmlFor="site-name">
                    {t("admin.siteNameLabel")}
                  </label>
                  <input
                    id="site-name"
                    className={`${input} mt-1.5`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canEdit || saving}
                    maxLength={120}
                  />
                </div>

                {displayCoords && (
                  <StaticMap
                    lat={displayCoords.lat}
                    lng={displayCoords.lng}
                    label={name.trim() || t("admin.siteDefaultName")}
                    noKeyFallback="embed"
                    className="mt-2"
                  />
                )}

                {displayCoords && (
                  <p className={`text-[0.8125rem] ${hint}`}>
                    {t("admin.siteCoordsHint")
                      .replace("{lat}", displayCoords.lat.toFixed(6))
                      .replace("{lng}", displayCoords.lng.toFixed(6))}
                  </p>
                )}

                {canEdit ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => void captureCurrentLocation()}
                      disabled={locating || saving}
                    >
                      {locating ? t("admin.siteLocating") : t("admin.siteUseCurrentLocation")}
                    </button>
                    <button
                      type="button"
                      className={btnPrimary}
                      onClick={() => void saveSite()}
                      disabled={saving || locating}
                    >
                      {saving ? t("admin.siteSaving") : site ? t("admin.siteUpdate") : t("admin.siteRegister")}
                    </button>
                  </div>
                ) : (
                  <p className={`text-[0.8125rem] ${hint}`}>{t("admin.siteReadOnly")}</p>
                )}
              </div>

              {error && <p className={`mt-3 text-[0.875rem] ${errorText}`}>{error}</p>}
              {saved && <p className={`mt-3 text-[0.875rem] ${successText}`}>{t("admin.siteSaved")}</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
