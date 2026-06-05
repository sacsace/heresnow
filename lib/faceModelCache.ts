"use client";

const CACHE_NAME = "heresnow-face-v1";

/** 런타임에 실제로 로드하는 모델 바이너리 (manifest보다 용량이 큼 — 먼저 받기) */
export const FACE_MODEL_BIN_URLS = [
  "/models/face_recognition_model.bin",
  "/models/tiny_face_detector_model.bin",
  "/models/face_landmark_68_tiny_model.bin",
] as const;

export const FACE_MODEL_MANIFEST_URLS = [
  "/models/tiny_face_detector_model-weights_manifest.json",
  "/models/face_landmark_68_tiny_model-weights_manifest.json",
  "/models/face_recognition_model-weights_manifest.json",
] as const;

let binsPrefetchStarted = false;

async function cacheFetch(url: string, fetchImpl: typeof fetch): Promise<Response> {
  if (!("caches" in window)) {
    return fetchImpl(url);
  }
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(url);
  if (hit) return hit;

  const res = await fetchImpl(url);
  if (res.ok) {
    try {
      await cache.put(url, res.clone());
    } catch {
      /* quota 등 — 무시하고 진행 */
    }
  }
  return res;
}

/** face-api loadFromUri 동안 /models·/tfjs-wasm 요청을 Cache API로 재사용 */
export async function withCachedModelFetch<T>(run: () => Promise<T>): Promise<T> {
  if (typeof window === "undefined") {
    return run();
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url.includes("/models/") || url.includes("/tfjs-wasm/")) {
      return cacheFetch(url, nativeFetch);
    }
    return nativeFetch(input, init);
  }) as typeof fetch;

  try {
    return await run();
  } finally {
    window.fetch = nativeFetch;
  }
}

/** manifest + 대용량 bin을 HTTP·Cache API에 미리 적재 */
export function prefetchFaceModelAssets(): void {
  if (typeof window === "undefined") return;

  for (const path of FACE_MODEL_MANIFEST_URLS) {
    void cacheFetch(path, fetch).catch(() => {});
  }

  if (binsPrefetchStarted) return;
  binsPrefetchStarted = true;

  for (const path of FACE_MODEL_BIN_URLS) {
    void cacheFetch(path, fetch).catch(() => {});
  }
}
