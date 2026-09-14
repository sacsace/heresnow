"use client";

import { useI18n } from "@/components/LanguageProvider";
import { btnSecondary, link } from "@/lib/uiStyles";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "leaflet/dist/leaflet.css";

type MapBaseLayer = "street" | "satellite";

type Props = {
  open: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  title?: string;
  subtitle?: string;
};

export function LocationMapModal({ open, onClose, lat, lng, title, subtitle }: Props) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [baseLayer, setBaseLayer] = useState<MapBaseLayer>("street");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const streetLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const satelliteLayerRef = useRef<import("leaflet").TileLayer | null>(null);
  const baseLayerRef = useRef(baseLayer);
  baseLayerRef.current = baseLayer;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) setBaseLayer("street");
  }, [open]);

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

  useEffect(() => {
    if (!open) return;
    applyBaseLayer(baseLayer);
  }, [open, baseLayer, applyBaseLayer]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !mapContainerRef.current) return;

    let cancelled = false;
    const timeoutIds: number[] = [];
    let map: import("leaflet").Map | null = null;
    const container = mapContainerRef.current;

    const safeInvalidateSize = () => {
      if (cancelled) return;
      const active = mapInstanceRef.current;
      if (!active || active.getContainer() !== container) return;
      try {
        active.invalidateSize();
      } catch {
        // ignore teardown races
      }
    };

    void (async () => {
      let L: typeof import("leaflet");
      try {
        L = await import("leaflet");
      } catch {
        return;
      }

      if (cancelled || !mapContainerRef.current) return;

      map = L.map(mapContainerRef.current, {
        scrollWheelZoom: true,
      }).setView([lat, lng], 16);

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
      applyBaseLayer(baseLayerRef.current);

      L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: "#007AFF",
        color: "#fff",
        weight: 2,
        fillOpacity: 0.95,
      })
        .addTo(map)
        .bindPopup(
          [
            title ? `<strong>${escapeHtml(title)}</strong>` : "",
            `<span class="text-xs">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>`,
          ]
            .filter(Boolean)
            .join("<br/>")
        )
        .openPopup();

      mapInstanceRef.current = map;

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
      mapInstanceRef.current = null;
      streetLayerRef.current = null;
      satelliteLayerRef.current = null;
      if (map) {
        map.remove();
        map = null;
      }
    };
  }, [open, lat, lng, title, applyBaseLayer]);

  if (!open || !mounted) return null;

  const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? t("common.mapEmbedTitle")}
    >
      <button
        type="button"
        aria-label={t("admin.attendanceCalendarDetailClose")}
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-black/40 backdrop-blur-sm"
      />
      <div
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-[var(--background)] shadow-2xl ring-1 ring-black/[0.05] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--separator)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-[1rem] font-semibold text-[var(--foreground)]">
              {title ?? t("common.mapEmbedTitle")}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-[0.8125rem] text-[var(--apple-label-secondary)]">{subtitle}</p>
            ) : null}
            <p className="mt-1 text-[0.75rem] tabular-nums text-[var(--apple-label-tertiary)]">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </p>
          </div>
          <button type="button" className={btnSecondary} onClick={onClose}>
            {t("admin.attendanceCalendarDetailClose")}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
          <div className="mb-2 flex justify-end">
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
          <div
            ref={mapContainerRef}
            className="h-[min(24rem,55vh)] w-full min-h-[16rem] rounded-2xl bg-[var(--fill-tertiary)] ring-1 ring-black/[0.04]"
          />
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 inline-block text-[0.8125rem] ${link}`}
          >
            {t("common.mapOpenLargeLink")}
          </a>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
