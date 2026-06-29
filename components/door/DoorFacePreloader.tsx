"use client";

import { FACE_MODEL_BIN_URLS, FACE_MODEL_MANIFEST_URLS } from "@/lib/faceModelCache";
import { prefetchFaceRecognition } from "@/lib/faceRecognitionClient";
import { getFaceDeviceProfile } from "@/lib/faceDeviceProfile";
import { useEffect } from "react";

/** 출입문 단말: 안면 모델·FaceCapture 청크 선로드 */
export function DoorFacePreloader() {
  useEffect(() => {
    const profile = getFaceDeviceProfile();

    for (const href of [...FACE_MODEL_MANIFEST_URLS, ...FACE_MODEL_BIN_URLS]) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "fetch";
      link.href = href;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }

    if (profile.preferWasmBackend) {
      const wasm = document.createElement("link");
      wasm.rel = "preload";
      wasm.as = "fetch";
      wasm.href = "/tfjs-wasm/tfjs-backend-wasm.wasm";
      wasm.crossOrigin = "anonymous";
      document.head.appendChild(wasm);
    }

    prefetchFaceRecognition(true);
    void import("@/components/employee/FaceCapture");
  }, []);

  return null;
}
