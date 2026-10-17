import {
  isFaceEmbedServiceConfigured,
  matchDescriptorV2Gallery,
  parseDescriptorV2,
  requestFaceEmbedding,
  type ServerFaceMatchResult,
} from "@/lib/faceEmbedService";
import {
  matchFaceCredentials,
  matchFaceCredentialsForPunch,
  type FaceCredentialRow,
} from "@/lib/faceCredentials";
import { resolveFaceIdentityPolicy } from "@/lib/faceIdentityPolicy";

export type HybridFaceMatchInput = {
  credentials: Array<FaceCredentialRow & { descriptorV2?: unknown }>;
  /** face-api 128-d probe (항상 권장) */
  probe128: number[] | null;
  /** 얼굴 JPEG data URL — 서버 임베딩용 (V1 실패 시 보조) */
  faceImageDataUrl?: string | null;
  /** punch: 출퇴근 1:1 — V1 우선, 최소 인식률 60% */
  purpose?: "punch" | "default";
};

export type HybridFaceMatchResult = {
  matched: boolean;
  confidencePercent: number;
  distance?: number;
  path: "server_v2" | "client_v1" | "none";
  server?: ServerFaceMatchResult;
};

/**
 * 출퇴근은 기존 face-api(V1) 등록을 우선 매칭해 배포/임베딩 변경으로
 * 기존 사용자가 깨지지 않게 한다. V2는 V1 실패 시에만 보조.
 */
export async function matchFaceHybrid(input: HybridFaceMatchInput): Promise<HybridFaceMatchResult> {
  const punch = input.purpose === "punch";
  const minConf = punch ? resolveFaceIdentityPolicy().punchMinConfidencePercent : 0;

  let v1Fail: HybridFaceMatchResult | null = null;

  if (input.probe128) {
    const v1 = punch
      ? matchFaceCredentialsForPunch(input.credentials, input.probe128)
      : matchFaceCredentials(input.credentials, input.probe128);
    if (v1.matched && v1.confidencePercent >= minConf) {
      return {
        matched: true,
        confidencePercent: v1.confidencePercent,
        distance: v1.distance,
        path: "client_v1",
      };
    }
    v1Fail = {
      matched: false,
      confidencePercent: v1.confidencePercent,
      distance: v1.distance,
      path: "client_v1",
    };
    /** 저신뢰(20~40%대)는 V2로도 우회 불가 — 본인 확인 강화 */
    if (punch && v1.reason === "LOW_CONFIDENCE") {
      return v1Fail;
    }
  }

  const galleryV2 = input.credentials
    .map((c) => parseDescriptorV2(c.descriptorV2))
    .filter((v): v is number[] => v != null);

  const v2Threshold = punch ? 0.45 : undefined;

  if (
    galleryV2.length > 0 &&
    input.faceImageDataUrl &&
    isFaceEmbedServiceConfigured()
  ) {
    const emb = await requestFaceEmbedding(input.faceImageDataUrl);
    if (emb) {
      const server = matchDescriptorV2Gallery(
        galleryV2,
        emb.embedding,
        v2Threshold
      );
      if (server.matched && server.confidencePercent >= minConf) {
        return {
          matched: true,
          confidencePercent: server.confidencePercent,
          path: "server_v2",
          server,
        };
      }
      return {
        matched: false,
        confidencePercent: Math.max(server.confidencePercent, v1Fail?.confidencePercent ?? 0),
        distance: v1Fail?.distance,
        path: "server_v2",
        server,
      };
    }
  }

  if (v1Fail) return v1Fail;
  return { matched: false, confidencePercent: 0, path: "none" };
}

/** 등록 직후 preview로 V2 임베딩 저장 (실패해도 등록은 유지) */
export async function attachDescriptorV2ToCredentials(
  credentialIds: string[],
  previewUrl: string | null | undefined
): Promise<{ ok: boolean; model?: string }> {
  if (!previewUrl || credentialIds.length === 0 || !isFaceEmbedServiceConfigured()) {
    return { ok: false };
  }
  const emb = await requestFaceEmbedding(previewUrl);
  if (!emb) return { ok: false };

  const { prisma } = await import("@/lib/prisma");
  await prisma.employeeFaceCredential.updateMany({
    where: { id: { in: credentialIds } },
    data: {
      descriptorV2: emb.embedding,
      embedModel: emb.model,
    },
  });
  return { ok: true, model: emb.model };
}
