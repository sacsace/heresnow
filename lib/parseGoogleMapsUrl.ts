/** Google Maps URL(단축·전체)에서 위·경도 추출 */

export type MapsLatLng = { lat: number; lng: number };

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function pair(latStr: string, lngStr: string): MapsLatLng | null {
  const lat = Number(latStr);
  const lng = Number(lngStr);
  return isValidLatLng(lat, lng) ? { lat, lng } : null;
}

/** maps.app.goo.gl / google.com/maps 등 링크 여부 */
export function isLikelyGoogleMapsUrl(input: string): boolean {
  const s = input.trim();
  if (!s) return false;
  return /(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|google\.[^/\s]+\/maps)/i.test(s);
}

/**
 * URL·리다이렉트 최종 주소·HTML 조각에서 좌표 파싱.
 * 장소 핀(`!3d…!4d…`)을 지도 중심(`@lat,lng`)보다 우선한다.
 */
export function parseGoogleMapsCoords(input: string): MapsLatLng | null {
  const raw = input.trim();
  if (!raw) return null;

  const pin = raw.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) {
    const coords = pair(pin[1], pin[2]);
    if (coords) return coords;
  }

  const at = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (at) {
    const coords = pair(at[1], at[2]);
    if (coords) return coords;
  }

  const query = raw.match(
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i
  );
  if (query) {
    const coords = pair(query[1], query[2]);
    if (coords) return coords;
  }

  const bare = raw.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/
  );
  if (bare) {
    const coords = pair(bare[1], bare[2]);
    if (coords) return coords;
  }

  return null;
}
