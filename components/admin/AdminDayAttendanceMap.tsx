"use client";

import { useI18n } from "@/components/LanguageProvider";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export type DayMapMarker = {
  employeeId: string;
  employeeName: string;
  attendanceId: string;
  timestamp: string;
  checkInTime: string;
  /** 회사 타임존 기준 출근 일자(YYYY-MM-DD) */
  date?: string;
  latitude: number;
  longitude: number;
  isBusinessTrip: boolean;
  businessTripLocation: string | null;
  businessTripReason: string | null;
};

type MapBaseLayer = "street" | "satellite";

type MapFocusTarget = {
  employeeId: string;
  attendanceId?: string;
};

type Props = {
  /** 단일 날짜 모드 */
  date?: string;
  /** 기간 모드(from/to YYYY-MM-DD) */
  from?: string;
  to?: string;
  /** SUPER_ADMIN이 다른 회사 일자 지도를 조회할 때만 지정. */
  companyId?: string;
  className?: string;
};

type MarkerMeta = {
  employeeId: string;
  color: string;
};

type LeafletMapCanvasProps = {
  markers: DayMapMarker[];
  isRange: boolean;
  baseLayer: MapBaseLayer;
  dateLocale: string;
  focusTarget: MapFocusTarget | null;
  onInitError: (message: string | null) => void;
};

const MARKER_RADIUS_DEFAULT = 9;
const MARKER_RADIUS_FOCUSED = 11;
const MARKER_RADIUS_PIN = 14;

function LeafletMapCanvas({
  markers,
  isRange,
  baseLayer,
  dateLocale,
  focusTarget,
  onInitError,
}: LeafletMapCanvasProps) {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const layerGroupRef = useRef<import("leaflet").LayerGroup | null>(null);
  const streetLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const satelliteLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const markerByAttendanceRef = useRef<Map<string, import("leaflet").CircleMarker>>(new Map());
  const markerMetaRef = useRef<Map<string, MarkerMeta>>(new Map());
  const baseLayerRef = useRef(baseLayer);
  baseLayerRef.current = baseLayer;

  const applyBaseLayer = useCallback((layer: MapBaseLayer) => {
    const map = mapInstanceRef.current;
    const street = streetLayerRef.current;
    const satellite = satelliteLayerRef.current;
    if (!map || !street || !satellite) return;

    try {
      if (layer === "street") {
        if (map.hasLayer(satellite)) map.removeLayer(satellite);
        if (!map.hasLayer(street)) street.addTo(map);
        return;
      }

      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(satellite)) satellite.addTo(map);
    } catch {
      // map.remove() 직후 레이어 전환 시 무시
    }
  }, []);

  const resetMarkerStyles = useCallback(() => {
    for (const [attendanceId, marker] of markerByAttendanceRef.current) {
      const meta = markerMetaRef.current.get(attendanceId);
      if (!meta) continue;
      marker.setStyle({
        radius: MARKER_RADIUS_DEFAULT,
        fillColor: meta.color,
        color: "#fff",
        weight: 2,
        fillOpacity: 0.9,
      });
    }
  }, []);

  const applyFocus = useCallback(
    (target: MapFocusTarget | null) => {
      const map = mapInstanceRef.current;
      const L = leafletRef.current;
      if (!map || !L) return;

      resetMarkerStyles();
      map.closePopup();

      if (!target) return;

      const employeeMarkers: import("leaflet").CircleMarker[] = [];
      for (const [attendanceId, marker] of markerByAttendanceRef.current) {
        const meta = markerMetaRef.current.get(attendanceId);
        if (!meta || meta.employeeId !== target.employeeId) {
          marker.setStyle({ fillOpacity: 0.22, weight: 1, color: "#fff" });
          continue;
        }
        employeeMarkers.push(marker);
        const pinned = target.attendanceId === attendanceId;
        marker.setStyle({
          radius: pinned ? MARKER_RADIUS_PIN : MARKER_RADIUS_FOCUSED,
          fillColor: meta.color,
          color: "#1e293b",
          weight: pinned ? 3 : 2,
          fillOpacity: 1,
        });
        if (pinned) marker.bringToFront();
      }

      if (employeeMarkers.length === 0) return;

      const bounds = L.latLngBounds(employeeMarkers.map((m) => m.getLatLng()));
      if (bounds.isValid()) {
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          map.flyTo(bounds.getCenter(), target.attendanceId ? 16 : 14, { duration: 0.7 });
        } else {
          map.flyToBounds(bounds.pad(0.2), {
            maxZoom: target.attendanceId ? 16 : 15,
            duration: 0.7,
          });
        }
      }

      const popupMarker = target.attendanceId
        ? markerByAttendanceRef.current.get(target.attendanceId)
        : employeeMarkers[0];
      window.setTimeout(() => popupMarker?.openPopup(), 750);
    },
    [resetMarkerStyles]
  );

  useLayoutEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const timeoutIds: number[] = [];
    let map: import("leaflet").Map | null = null;

    markerByAttendanceRef.current.clear();
    markerMetaRef.current.clear();

    const safeInvalidateSize = () => {
      if (cancelled) return;
      const active = mapInstanceRef.current;
      if (!active || active.getContainer() !== container) return;
      try {
        active.invalidateSize();
      } catch {
        // map.remove() 직후 DOM 정리 중이면 무시
      }
    };

    void (async () => {
      onInitError(null);
      let L: typeof import("leaflet");
      try {
        L = await import("leaflet");
      } catch (e) {
        if (!cancelled) {
          onInitError(
            e instanceof Error ? e.message : "지도 라이브러리를 불러오지 못했습니다."
          );
        }
        return;
      }

      if (cancelled || !mapContainerRef.current) return;

      leafletRef.current = L;

      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      map = L.map(mapContainerRef.current, {
        scrollWheelZoom: true,
        preferCanvas: true,
      }).setView([20.5937, 78.9629], 5);

      const street = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 20,
          subdomains: "abcd",
        }
      );
      const osmFallback = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
        subdomains: "abc",
      });
      street.on("tileerror", () => {
        const active = mapInstanceRef.current;
        if (!active || cancelled || !active.hasLayer(street)) return;
        active.removeLayer(street);
        if (!active.hasLayer(osmFallback)) osmFallback.addTo(active);
      });

      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Maxar, Earthstar Geographics',
          maxZoom: 19,
        }
      );

      streetLayerRef.current = street;
      satelliteLayerRef.current = satellite;

      const group = L.layerGroup().addTo(map);
      layerGroupRef.current = group;
      mapInstanceRef.current = map;

      const bounds = L.latLngBounds([]);
      const palette = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5856D6"];
      const employeeColor = new Map<string, string>();
      const colorFor = (empId: string) => {
        if (!employeeColor.has(empId)) {
          employeeColor.set(empId, palette[employeeColor.size % palette.length] ?? palette[0]!);
        }
        return employeeColor.get(empId)!;
      };

      markers.forEach((m) => {
        const latLng = L.latLng(m.latitude, m.longitude);
        bounds.extend(latLng);
        const color = colorFor(m.employeeId);
        const marker = L.circleMarker(latLng, {
          radius: MARKER_RADIUS_DEFAULT,
          fillColor: color,
          color: "#fff",
          weight: 2,
          fillOpacity: 0.9,
        });
        const lines = [`<strong>${escapeHtml(m.employeeName)}</strong>`];
        if (isRange && m.date) {
          lines.push(
            `${escapeHtml(formatDateLabel(m.date, dateLocale))} ${escapeHtml(m.checkInTime)}`
          );
        } else {
          lines.push(`${t("admin.monthlyIn")} ${escapeHtml(m.checkInTime)}`);
        }
        if (m.isBusinessTrip && m.businessTripLocation) {
          lines.push(`${t("admin.monthlyMapTrip")}: ${escapeHtml(m.businessTripLocation)}`);
        }
        if (m.isBusinessTrip && m.businessTripReason) {
          lines.push(`${t("admin.monthlyMapReason")}: ${escapeHtml(m.businessTripReason)}`);
        }
        lines.push(
          `<span class="text-xs">${m.latitude.toFixed(5)}, ${m.longitude.toFixed(5)}</span>`
        );
        marker.bindPopup(lines.join("<br/>"));
        marker.addTo(group);
        markerByAttendanceRef.current.set(m.attendanceId, marker);
        markerMetaRef.current.set(m.attendanceId, { employeeId: m.employeeId, color });
      });

      if (bounds.isValid()) {
        if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
          map.setView(bounds.getCenter(), 14);
        } else {
          map.fitBounds(bounds.pad(0.2), { maxZoom: 15 });
        }
      }

      resizeObserver = new ResizeObserver(() => {
        safeInvalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);

      applyBaseLayer(baseLayerRef.current);

      map.whenReady(() => {
        if (cancelled || mapInstanceRef.current !== map) return;
        applyBaseLayer(baseLayerRef.current);
        safeInvalidateSize();
        timeoutIds.push(window.setTimeout(safeInvalidateSize, 100));
        timeoutIds.push(window.setTimeout(safeInvalidateSize, 400));
      });
    })();

    return () => {
      cancelled = true;
      for (const id of timeoutIds) window.clearTimeout(id);
      resizeObserver?.disconnect();
      mapInstanceRef.current = null;
      leafletRef.current = null;
      markerByAttendanceRef.current.clear();
      markerMetaRef.current.clear();
      if (map) {
        map.remove();
        map = null;
      }
      layerGroupRef.current = null;
      streetLayerRef.current = null;
      satelliteLayerRef.current = null;
    };
  // key={queryString}로 조회마다 remount — 마운트 시 1회 초기화
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyBaseLayer(baseLayer);
  }, [baseLayer, applyBaseLayer]);

  useEffect(() => {
    applyFocus(focusTarget);
  }, [focusTarget, applyFocus]);

  return (
    <div
      ref={mapContainerRef}
      id="admin-day-attendance-map"
      className="z-0 h-[min(36rem,65vh)] w-full min-h-[21rem] rounded-2xl bg-[var(--fill-tertiary)] ring-1 ring-black/[0.04]"
    />
  );
}

export function AdminDayAttendanceMap({ date, from, to, companyId, className }: Props) {
  const { t, locale } = useI18n();
  const [baseLayer, setBaseLayer] = useState<MapBaseLayer>("street");
  const [markers, setMarkers] = useState<DayMapMarker[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapInitError, setMapInitError] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);

  const isRange = Boolean(from && to && !date);
  const dateLocale = locale === "en" ? "en-US" : "ko-KR";

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    else if (from && to) {
      params.set("from", from);
      params.set("to", to);
    }
    if (companyId) params.set("companyId", companyId);
    return params.toString();
  }, [date, from, to, companyId]);

  const handleMapInitError = useCallback((message: string | null) => {
    setMapInitError(message);
  }, []);

  const focusEmployee = useCallback((employeeId: string, attendanceId?: string) => {
    setFocusTarget({ employeeId, attendanceId });
    document.getElementById("admin-day-attendance-map")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  const loadMarkers = useCallback(async () => {
    setError(null);
    setFocusTarget(null);
    if (!queryString) {
      setLoading(false);
      setMarkers([]);
      setTimezone(null);
      return;
    }
    setLoading(true);
    setMarkers([]);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      const r = await fetch(`/api/admin/dashboard/day-map?${queryString}`, {
        signal: controller.signal,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMarkers([]);
        setTimezone(null);
        const err = j.error;
        const msg = j.message;
        setError(
          typeof msg === "string"
            ? msg
            : typeof err === "string"
              ? err
              : typeof err === "object" && err !== null && "message" in err
                ? String((err as { message: unknown }).message)
                : t("admin.monthlyMapLoadFail")
        );
        return;
      }
      setMarkers((j as { markers?: DayMapMarker[] }).markers ?? []);
      setTimezone((j as { timezone?: string }).timezone ?? null);
    } catch {
      setMarkers([]);
      setTimezone(null);
      setError(t("admin.monthlyMapLoadFail"));
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [queryString, t]);

  useEffect(() => {
    void loadMarkers();
  }, [loadMarkers]);

  // 기간 모드: 직원별 그룹핑 후 일자 오름차순 표시
  const grouped = useMemo(() => {
    if (!isRange) return null;
    const map = new Map<string, { name: string; items: DayMapMarker[] }>();
    for (const m of markers) {
      const cur = map.get(m.employeeId) ?? { name: m.employeeName, items: [] };
      cur.items.push(m);
      map.set(m.employeeId, cur);
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        id,
        name: v.name,
        items: v.items.slice().sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, locale === "en" ? "en" : "ko"));
  }, [markers, isRange, locale]);

  const showMap = !error && markers.length > 0;
  const focusedEmployeeId = focusTarget?.employeeId ?? null;
  const focusedAttendanceId = focusTarget?.attendanceId ?? null;

  return (
    <div className={className}>
      {loading && markers.length === 0 && (
        <p className="text-[0.9375rem] text-[var(--apple-label-secondary)]">{t("common.loading")}</p>
      )}
      {error && <p className="text-sm text-[var(--apple-red)]">{error}</p>}
      {mapInitError && !error && (
        <p className="text-sm text-amber-800">{mapInitError}</p>
      )}
      {!loading && !error && markers.length === 0 && (
        <p className="text-[0.9375rem] text-[var(--apple-label-secondary)]">{t("admin.monthlyMapNoCheckIns")}</p>
      )}
      {showMap && (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--apple-label-secondary)]">
              {t("admin.monthlyMapCountLabel")}: {markers.length}
              {timezone ? ` · ${timezone}` : ""}
              {loading ? ` · ${t("common.loading")}` : ""}
            </p>
            <div
              className="flex rounded-[0.625rem] bg-[var(--fill-secondary)] p-0.5"
              role="group"
              aria-label={t("admin.monthlyMapLayerLabel")}
            >
              <button
                type="button"
                aria-pressed={baseLayer === "street"}
                className={`rounded-[0.5rem] px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
                  baseLayer === "street"
                    ? "bg-[var(--grouped-bg)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--apple-label-secondary)]"
                }`}
                onClick={() => setBaseLayer("street")}
              >
                {t("admin.monthlyMapLayerStreet")}
              </button>
              <button
                type="button"
                aria-pressed={baseLayer === "satellite"}
                className={`rounded-[0.5rem] px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
                  baseLayer === "satellite"
                    ? "bg-[var(--grouped-bg)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--apple-label-secondary)]"
                }`}
                onClick={() => setBaseLayer("satellite")}
              >
                {t("admin.monthlyMapLayerSatellite")}
              </button>
            </div>
          </div>
          {!loading && !mapInitError && (
            <LeafletMapCanvas
              key={queryString}
              markers={markers}
              isRange={isRange}
              baseLayer={baseLayer}
              dateLocale={dateLocale}
              focusTarget={focusTarget}
              onInitError={handleMapInitError}
            />
          )}
          {isRange && (
            <p className="mt-2 text-[0.75rem] text-[var(--apple-label-tertiary)]">
              {t("admin.monthlyMapFocusHint")}
            </p>
          )}
          {/* 단일 날짜 모드: 평면 리스트 */}
          {!isRange && (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {markers.map((m) => (
                <li key={m.attendanceId}>
                  <button
                    type="button"
                    aria-label={t("admin.monthlyMapShowOnMap").replace("{name}", m.employeeName)}
                    aria-pressed={focusedEmployeeId === m.employeeId}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-left text-[0.8125rem] transition-colors ${
                      focusedEmployeeId === m.employeeId
                        ? "bg-[var(--pastel-blue-strong)] ring-2 ring-[var(--apple-blue)]"
                        : "bg-[var(--fill-tertiary)] hover:bg-[var(--fill-secondary)]"
                    }`}
                    onClick={() => focusEmployee(m.employeeId, m.attendanceId)}
                  >
                    <span className="font-medium text-[var(--foreground)]">{m.employeeName}</span>
                    <span className="text-[var(--apple-label-secondary)]"> · {m.checkInTime}</span>
                    {m.isBusinessTrip && m.businessTripLocation && (
                      <span className="block text-amber-800">
                        {t("admin.monthlyMapTrip")}: {m.businessTripLocation}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* 기간 모드: 직원별 그룹 + 일자별 칩 */}
          {isRange && grouped && (
            <ul className="mt-3 space-y-2">
              {grouped.map((g) => (
                <li key={g.id}>
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-[0.8125rem] transition-colors ${
                      focusedEmployeeId === g.id && !focusedAttendanceId
                        ? "bg-[var(--pastel-blue-strong)] ring-2 ring-[var(--apple-blue)]"
                        : "bg-[var(--fill-tertiary)]"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={t("admin.monthlyMapShowOnMap").replace("{name}", g.name)}
                      aria-pressed={focusedEmployeeId === g.id && !focusedAttendanceId}
                      className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-left hover:opacity-90"
                      onClick={() => focusEmployee(g.id)}
                    >
                      <span className="font-medium text-[var(--foreground)]">{g.name}</span>
                      <span className="text-[var(--apple-label-tertiary)]">
                        {t("admin.monthlyMapDays").replace("{n}", String(g.items.length))}
                      </span>
                    </button>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {g.items.map((m) => {
                        const dayLabel = m.date ? formatDateLabel(m.date, dateLocale) : "";
                        const chipSelected =
                          focusedEmployeeId === g.id && focusedAttendanceId === m.attendanceId;
                        return (
                          <button
                            key={m.attendanceId}
                            type="button"
                            aria-label={t("admin.monthlyMapShowDayOnMap").replace("{date}", dayLabel)}
                            aria-pressed={chipSelected}
                            className={`rounded-full px-2 py-0.5 text-[0.75rem] ring-1 transition-colors ${
                              chipSelected
                                ? "bg-[var(--apple-blue)] text-white ring-[var(--apple-blue)]"
                                : "bg-[var(--background)]/70 text-[var(--apple-label-secondary)] ring-black/[0.04] hover:bg-[var(--fill-secondary)]"
                            }`}
                            title={`${m.latitude.toFixed(5)}, ${m.longitude.toFixed(5)}`}
                            onClick={() => focusEmployee(g.id, m.attendanceId)}
                          >
                            {dayLabel} · {m.checkInTime}
                            {m.isBusinessTrip ? " ✈︎" : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function formatDateLabel(ymd: string, dl: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString(dl, {
    month: "numeric",
    day: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
