"use client";

type StaticMapProps = {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
  /** 키 없음: link=텍스트 링크만(기본), embed=Google 지도 iframe */
  noKeyFallback?: "link" | "embed";
};

/**
 * Google 지도 미리보기
 * - `NEXT_PUBLIC_GOOGLE_MAPS_KEY` 있으면 Static Maps 이미지
 * - 없으면 `noKeyFallback`: 링크만 또는 iframe 임베드(추가 API 키 불필요)
 */
export function StaticMap({ lat, lng, label, className, noKeyFallback = "link" }: StaticMapProps) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const openUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  if (!key) {
    if (noKeyFallback === "embed") {
      const embedSrc = `https://maps.google.com/maps?q=${lat},${lng}&hl=ko&z=16&output=embed`;
      return (
        <div className={className}>
          <iframe
            title={label ?? "현재 위치"}
            src={embedSrc}
            className="h-[clamp(11rem,36vh,22rem)] w-full max-w-full rounded-lg border border-slate-200 bg-zinc-100 sm:h-[clamp(12rem,40vh,24rem)] md:h-[clamp(14rem,45vh,26rem)]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-sky-700 underline"
          >
            Google 지도에서 크게 보기
          </a>
        </div>
      );
    }
    return (
      <a
        href={openUrl}
        target="_blank"
        rel="noreferrer"
        className={`text-xs text-sky-700 underline ${className ?? ""}`}
      >
        지도에서 열기 ({label ?? "위치"})
      </a>
    );
  }

  const src = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=320x160&scale=2&markers=color:red%7C${lat},${lng}&key=${encodeURIComponent(key)}`;

  return (
    <a href={openUrl} target="_blank" rel="noreferrer" className={`block ${className ?? ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="위치 미리보기" className="h-auto w-full max-w-full rounded-lg border border-slate-200" />
    </a>
  );
}
