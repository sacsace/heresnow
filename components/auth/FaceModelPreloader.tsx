"use client";

import { FACE_MODEL_BIN_URLS, FACE_MODEL_MANIFEST_URLS } from "@/lib/faceModelCache";
import { prefetchFaceRecognition } from "@/lib/faceRecognitionClient";
import { getFaceDeviceProfile } from "@/lib/faceDeviceProfile";
import { useEffect } from "react";

/** 로그인 라우트: 모델·JS 청크를 페이지 진입 직후 선로드 */
export function FaceModelPreloader() {
  useEffect(() => {
    const profile = getFaceDeviceProfile();

    for (const href of [...FACE_MODEL_MANIFEST_URLS, ...FACE_MODEL_BIN_URLS]) {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = href.endsWith(".bin") ? "fetch" : "fetch";
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
    void import("@/components/auth/FaceLoginSection");
    void import("@/components/employee/FaceCapture");
  }, []);

  return null;
}
