"use client";

import { FACE_DESCRIPTOR_LENGTH } from "@/lib/faceMatch";

export type FaceApiModule = typeof import("@vladmandic/face-api");

let faceApiMod: FaceApiModule | null = null;
let modelsReady = false;
let loadPromise: Promise<void> | null = null;

export async function loadFaceModels(): Promise<void> {
  if (modelsReady) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const tf = await import("@tensorflow/tfjs-core");
    await import("@tensorflow/tfjs-backend-webgl");
    try {
      await tf.setBackend("webgl");
      await tf.ready();
    } catch (e) {
      // 일부 모바일·구형 브라우저는 WebGL 가속이 없거나 차단됨 → CPU 폴백
      console.warn("[face] WebGL backend unavailable, falling back to CPU", e);
      try {
        await tf.setBackend("cpu");
        await tf.ready();
      } catch {
        loadPromise = null;
        throw new Error("FACE_BACKEND_UNAVAILABLE");
      }
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
