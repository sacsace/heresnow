"use client";

import { FACE_DESCRIPTOR_LENGTH } from "@/lib/faceMatch";

export type FaceApiModule = typeof import("@vladmandic/face-api");

let faceApiMod: FaceApiModule | null = null;
let modelsReady = false;
let loadPromise: Promise<void> | null = null;
let activeBackend: "webgl" | "wasm" | "cpu" | null = null;

export function getActiveFaceBackend(): "webgl" | "wasm" | "cpu" | null {
  return activeBackend;
}

/**
 * iOS Safari를 포함한 다양한 환경에서 안정적으로 동작하도록
 * 백엔드 우선순위: WebGL → WASM(SIMD) → CPU.
 *
 * - WebGL: 데스크톱·최신 안드로이드에서 가장 빠름.
 * - WASM:  iOS Safari WebGL 정밀도 이슈를 회피하는 표준 폴백.
 * - CPU:   최후의 수단(매우 느림).
 */
export async function loadFaceModels(): Promise<void> {
  if (modelsReady) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const tf = await import("@tensorflow/tfjs-core");

    let backendOk = false;

    // 1) WebGL 시도
    try {
      await import("@tensorflow/tfjs-backend-webgl");
      await tf.setBackend("webgl");
      await tf.ready();
      activeBackend = "webgl";
      backendOk = true;
    } catch (e) {
      console.warn("[face] WebGL backend unavailable, will try WASM", e);
    }

    // 2) WASM 폴백 (iOS Safari 권장 경로)
    if (!backendOk) {
      try {
        const wasm = await import("@tensorflow/tfjs-backend-wasm");
        // CDN에서 WASM 바이너리 로드 — 번들에 .wasm을 끼워넣지 않아도 됨
        wasm.setWasmPaths(
          "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/"
        );
        await tf.setBackend("wasm");
        await tf.ready();
        activeBackend = "wasm";
        backendOk = true;
      } catch (e) {
        console.warn("[face] WASM backend unavailable, will try CPU", e);
      }
    }

    // 3) CPU 최후 폴백
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

    if (!backendOk) {
      loadPromise = null;
      throw new Error("FACE_BACKEND_UNAVAILABLE");
    }

    faceApiMod = await import("@vladmandic/face-api");
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
    modelsReady = true;
    console.info(`[face] ready on backend=${activeBackend}`);
  })();

  return loadPromise;
}

function getFaceApi(): FaceApiModule {
  if (!faceApiMod || !modelsReady) {
    throw new Error("Face models not loaded");
  }
  return faceApiMod;
}

/** 비디오/이미지에서 단일 얼굴 descriptor 추출 */
export async function extractFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  await loadFaceModels();
  const faceapi = getFaceApi();
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
  const result = await faceapi
    .detectSingleFace(input, opts)
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
