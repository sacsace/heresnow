import { distanceMeters } from "@/lib/haversine";

/** 회사 근무지 기본 허용 반경 (m) */
export const DEFAULT_SITE_RADIUS_M = 200;

export type CompanySite = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowedRadius: number;
};

export function computeDistanceFromSite(
  site: Pick<CompanySite, "latitude" | "longitude">,
  latitude: number,
  longitude: number
): number {
  return distanceMeters(site.latitude, site.longitude, latitude, longitude);
}

export function isWithinSiteRadius(
  site: Pick<CompanySite, "latitude" | "longitude" | "allowedRadius">,
  latitude: number,
  longitude: number
): { ok: true; distanceMeters: number } | { ok: false; distanceMeters: number; allowedRadius: number } {
  const distance = computeDistanceFromSite(site, latitude, longitude);
  if (distance <= site.allowedRadius) {
    return { ok: true, distanceMeters: distance };
  }
  return { ok: false, distanceMeters: distance, allowedRadius: site.allowedRadius };
}

export function geofenceErrorMessage(distance: number, allowedRadius: number): string {
  return `근무지 반경 ${Math.round(allowedRadius)}m 밖입니다. 현재 위치는 약 ${Math.round(distance)}m 떨어져 있습니다.`;
}
