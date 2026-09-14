/** 등록 시 카메라 프레임을 JPEG data URL로 저장 (미리보기용) */
export function captureVideoFrameAsJpegDataUrl(
  video: HTMLVideoElement,
  maxWidth = 480,
  quality = 0.82
): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;

  const scale = Math.min(1, maxWidth / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", quality);
}
