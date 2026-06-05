"use client";

import { FACE_DESCRIPTOR_LENGTH } from "@/lib/faceMatch";
import {
  prefetchFaceModelAssets,
  withCachedModelFetch,
} from "@/lib/faceModelCache";
import { getFaceDeviceProfile } from "@/lib/faceDeviceProfile";

export type FaceApiModule = typeof import("@vladmandic/face-api");

let faceApiMod: FaceApiModule | null = null;
let modelsReady = false;
let loadPromise: Promise<void> | null = null;
let activeBackend: "webgl" | "wasm" | "cpu" | null = null;

export function getActiveFaceBackend(): "webgl" | "wasm" | "cpu" | null {
  return activeBackend;
}

export function isFaceModelsReady(): boolean {
  return modelsReady;
}

/** @deprecated prefetchFaceModelAssets 사용 */
export function prefetchFaceModelFiles(): void {
  prefetchFaceModelAssets();
}

/**
 * 로그인·출근 화면 등에서 안면 모듈을 백그라운드 로드.
 * eager=true 이면 즉시 로드 (탭 전환·호버 등).
 */
export function prefetchFaceRecognition(eager = false): void {
  if (typeof window === "undefined") return;
  if (!canAttemptFaceRecognition().ok) return;
  if (modelsReady) return;

  prefetchFaceModelAssets();

  const startLoad = () => {
    void loadFaceModels().catch(() => {});
  };

  if (eager) {
    startLoad();
    return;
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(startLoad, { timeout: 800 });
  } else {
    setTimeout(startLoad, 100);
  }
}

/** HTTPS·카메라 API 등 선행 조건 (모델 로드 전 빠른 검사) */
export function canAttemptFaceRecognition(): {
  ok: boolean;
  reason?: "insecure" | "no_camera_api";
} {
  if (typeof window === "undefined") return { ok: false, reason: "no_camera_api" };
  if (!window.isSecureContext) return { ok: false, reason: "insecure" };
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return { ok: false, reason: "no_camera_api" };
  }
  return { ok: true };
}

async function initTfBackend(
  tf: typeof import("@tensorflow/tfjs-core"),
  profile: ReturnType<typeof getFaceDeviceProfile>
): Promise<void> {
  if (!profile.preferWasmBackend) {
    try {
      await import("@tensorflow/tfjs-backend-webgl");
      await tf.setBackend("webgl");
      await tf.ready();
      activeBackend = "webgl";
      return;
    } catch (e) {
      console.warn("[face] WebGL backend unavailable, will try WASM", e);
    }
  }

  try {
    const wasm = await import("@tensorflow/tfjs-backend-wasm");
    wasm.setWasmPaths("/tfjs-wasm/");
    await tf.setBackend("wasm");
    await tf.ready();
    activeBackend = "wasm";
    return;
  } catch (e) {
    console.warn("[face] WASM backend unavailable, will try CPU", e);
  }

  await tf.setBackend("cpu");
  await tf.ready();
  activeBackend = "cpu";
}

/**
 * WASM 바이너리는 CDN 대신 /public/tfjs-wasm 에 자체 호스팅 (CSP·오프라인·인앱 대응).
 * iOS WebKit 은 WebGL fp16 이슈로 WASM 우선, Android/데스크톱 은 WebGL 우선.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsReady) return;
  if (loadPromise) return loadPromise;

  loadPromise = withCachedModelFetch(async () => {
    const profile = getFaceDeviceProfile();
    prefetchFaceModelAssets();

    const tfCorePromise = import("@tensorflow/tfjs-core");
    const faceApiPromise = import("@vladmandic/face-api");
    const tf = await tfCorePromise;

    try {
      await initTfBackend(tf, profile);
    } catch (e) {
      loadPromise = null;
      console.error("[face] CPU backend also failed", e);
      throw new Error("FACE_BACKEND_UNAVAILABLE");
    }

    faceApiMod = await faceApiPromise;
    const modelPath = "/models";
    try {
      await faceApiMod.nets.tinyFaceDetector.loadFromUri(modelPath);
      await Promise.all([
        faceApiMod.nets.faceLandmark68TinyNet.loadFromUri(modelPath),
        faceApiMod.nets.faceRecognitionNet.loadFromUri(modelPath),
      ]);
    } catch (e) {
      loadPromise = null;
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`FACE_MODELS_FAILED:${detail}`);
    }

    modelsReady = true;
    void warmupFaceInference(faceApiMod).catch(() => {});
    console.info(
      `[face] ready backend=${activeBackend} inputSize=${profile.detectorInputSize}`
    );
  });

  return loadPromise;
}

function getFaceApi(): FaceApiModule {
  if (!faceApiMod || !modelsReady) {
    throw new Error("Face models not loaded");
  }
  return faceApiMod;
}

/** 첫 실제 스캔 전 GPU/WASM 워밍업 */
async function warmupFaceInference(faceapi: FaceApiModule): Promise<void> {
  if (typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx?.fillRect(0, 0, 64, 64);
  await faceapi
    .detectSingleFace(canvas, detectorOptions(faceapi))
    .withFaceLandmarks(true)
    .withFaceDescriptor();
}

function detectorOptions(faceapi: FaceApiModule) {
  const profile = getFaceDeviceProfile();
  return new faceapi.TinyFaceDetectorOptions({
    inputSize: profile.detectorInputSize,
    scoreThreshold: profile.detectorScoreThreshold,
  });
}

/** 비디오/이미지에서 단일 얼굴 descriptor 추출 */
export async function extractFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  await loadFaceModels();
  const faceapi = getFaceApi();

  const result = await faceapi
    .detectSingleFace(input, detectorOptions(faceapi))
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!result?.descriptor || result.descriptor.length !== FACE_DESCRIPTOR_LENGTH) {
    return null;
  }
  return result.descriptor;
}

export function descriptorToArray(d: Float32Array): number[] {
  return Array.from(d);
}
