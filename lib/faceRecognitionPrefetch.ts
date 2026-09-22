"use client";

/** face-api 청크를 페이지 초기 번들에서 분리해 선로드 */
export function prefetchFaceRecognitionLazy(eager = false): void {
  if (typeof window === "undefined") return;
  void import("@/lib/faceRecognitionClient").then((mod) => {
    mod.prefetchFaceRecognition(eager);
  });
}
