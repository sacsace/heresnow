"use client";

import { FACE_DESCRIPTOR_LENGTH } from "@/lib/faceMatch";
import { getFaceDeviceProfile } from "@/lib/faceDeviceProfile";

export type FaceApiModule = typeof import("@vladmandic/face-api");

let faceApiMod: FaceApiModule | null = null;
let modelsReady = false;
let loadPromise: Promise<void> | null = null;
let activeBackend: "webgl" | "wasm" | "cpu" | null = null;
let warmupDone = false;

export function getActiveFaceBackend(): "webgl" | "wasm" | "cpu" | null {
  return activeBackend;
}

export function isFaceModelsReady(): boolean {
  return modelsReady;
}

const FACE_MODEL_MANIFESTS = [
  "/models/tiny_face_detector_model-weights_manifest.json",
  "/models/face_landmark_68_tiny_model-weights_manifest.json",
  "/models/face_recognition_model-weights_manifest.json",
] as const;

let modelFilesPrefetched = false;

/** 모델 manifest·WASM 등 정적 파일을 HTTP 캐시에 미리 적재 */
export function prefetchFaceModelFiles(): void {
  if (typeof window === "undefined" || modelFilesPrefetched) return;
  modelFilesPrefetched = true;

  for (const path of FACE_MODEL_MANIFESTS) {
    void fetch(path).catch(() => {});
  }

  const profile = getFaceDeviceProfile();
  if (profile.preferWasmBackend) {
    void fetch("/tfjs-wasm/tfjs-backend-wasm.wasm").catch(() => {});
  }
}

/**
 * 로그인·출근 화면 등에서 idle 시점에 안면 모듈을 백그라운드 로드.
 * eager=true 이면 즉시 로드 (탭 전환·호버 등).
 */
export function prefetchFaceRecognition(eager = false): void {
  if (typeof window === "undefined") return;
  if (!canAttemptFaceRecognition().ok) return;
  if (modelsReady) return;

  prefetchFaceModelFiles();

  const startLoad = () => {
    void loadFaceModels().catch(() => {});
  };

  if (eager) {
    startLoad();
    return;
  }

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(startLoad, { timeout: 2500 });
  } else {
    setTimeout(startLoad, 250);
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

/**
 * WASM 바이너리는 CDN 대신 /public/tfjs-wasm 에 자체 호스팅 (CSP·오프라인·인앱 대응).
 * iOS WebKit 은 WebGL fp16 이슈로 WASM 우선, Android/데스크톱 은 WebGL 우선.
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsReady) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const profile = getFaceDeviceProfile();
    prefetchFaceModelFiles();

    const tfCorePromise = import("@tensorflow/tfjs-core");
    const faceApiPromise = import("@vladmandic/face-api");
    const tf = await tfCorePromise;

    let backendOk = false;

    if (!profile.preferWasmBackend) {
      try {
        await import("@tensorflow/tfjs-backend-webgl");
        await tf.setBackend("webgl");
        await tf.ready();
        activeBackend = "webgl";
        backendOk = true;
      } catch (e) {
        console.warn("[face] WebGL backend unavailable, will try WASM", e);
      }
    }

    if (!backendOk) {
      try {
        const wasm = await import("@tensorflow/tfjs-backend-wasm");
        wasm.setWasmPaths("/tfjs-wasm/");
        await tf.setBackend("wasm");
        await tf.ready();
        activeBackend = "wasm";
        backendOk = true;
      } catch (e) {
        console.warn("[face] WASM backend unavailable, will try CPU", e);
      }
    }

    if (!backendOk) {
      try {
        await tf.setBackend("cpu");
        await tf.ready();
        activeBackend = "cpu";
        backendOk = true;
      } catch (e) {
        console.error("[face] CPU backend also failed", e);
        loadPromise = null;
        throw new Error("FACE_BACKEND_UNAVAILABLE");
      }
    }

    faceApiMod = await faceApiPromise;
    const modelPath = "/models";
    try {
      await Promise.all([
        faceApiMod.nets.tinyFaceDetector.loadFromUri(modelPath),
        faceApiMod.nets.faceLandmark68TinyNet.loadFromUri(modelPath),
        faceApiMod.nets.faceRecognitionNet.loadFromUri(modelPath),
      ]);
    } catch (e) {
      loadPromise = null;
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`FACE_MODELS_FAILED:${detail}`);
    }

    if (!warmupDone) {
      try {
        await tf.ready();
        warmupDone = true;
      } catch {
        /* warm-up optional */
      }
    }

    modelsReady = true;
    console.info(
      `[face] ready backend=${activeBackend} inputSize=${profile.detectorInputSize}`
    );
  })();

  return loadPromise;
}

function getFaceApi(): FaceApiModule {
  if (!faceApiMod || !modelsReady) {
    throw new Error("Face models not loaded");
  }
  return faceApiMod;
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
