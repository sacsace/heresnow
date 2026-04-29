"use client";

/** Google Static Maps (키 없으면 외부 맵 링크만) */
export function StaticMap({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const openUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  if (!key) {
    return (
      <a
        href={openUrl}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-sky-700 underline"
      >
        지도에서 열기 ({label ?? "위치"})
      </a>
    );
  }

  const src = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=320x160&scale=2&markers=color:red%7C${lat},${lng}&key=${encodeURIComponent(key)}`;

  return (
    <a href={openUrl} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="위치 미리보기" className="max-w-full rounded-lg border border-slate-200" />
    </a>
  );
}
