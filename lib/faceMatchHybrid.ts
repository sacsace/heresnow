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
  /** 얼굴 JPEG data URL — InsightFace 서버 임베딩용 */
  faceImageDataUrl?: string | null;
  /** punch: 출퇴근 1:1 — V1·V2 중 높은 인식률 채택, 최소 60% */
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
 * V1(face-api)과 V2(InsightFace)를 함께 평가해 더 높은 인식률을 채택.
 * 기존 128-d 등록만 있어도 V1으로 동작하고, V2가 있으면 정확도가 올라간다.
 */
export async function matchFaceHybrid(input: HybridFaceMatchInput): Promise<HybridFaceMatchResult> {
  const punch = input.purpose === "punch";
  const minConf = punch ? resolveFaceIdentityPolicy().punchMinConfidencePercent : 0;

  const galleryV2 = input.credentials
    .map((c) => parseDescriptorV2(c.descriptorV2))
    .filter((v): v is number[] => v != null);

  const v2Threshold = punch ? 0.42 : undefined;

  const v1Task = (async (): Promise<HybridFaceMatchResult | null> => {
    if (!input.probe128) return null;
    const v1 = punch
      ? matchFaceCredentialsForPunch(input.credentials, input.probe128)
      : matchFaceCredentials(input.credentials, input.probe128);
    return {
      matched: v1.matched && v1.confidencePercent >= minConf,
      confidencePercent: v1.confidencePercent,
      distance: v1.distance,
      path: "client_v1",
    };
  })();

  const v2Task = (async (): Promise<HybridFaceMatchResult | null> => {
    if (
      galleryV2.length === 0 ||
      !input.faceImageDataUrl ||
      !isFaceEmbedServiceConfigured()
    ) {
      return null;
    }
    const emb = await requestFaceEmbedding(input.faceImageDataUrl);
    if (!emb) return null;
    const server = matchDescriptorV2Gallery(galleryV2, emb.embedding, v2Threshold);
    return {
      matched: server.matched && server.confidencePercent >= minConf,
      confidencePercent: server.confidencePercent,
      path: "server_v2",
      server,
    };
  })();

  const [v1, v2] = await Promise.all([v1Task, v2Task]);

  const passed = [v1, v2]
    .filter((r): r is HybridFaceMatchResult => r != null && r.matched)
    .sort((a, b) => b.confidencePercent - a.confidencePercent);
  if (passed[0]) return passed[0];

  const failed = [v1, v2]
    .filter((r): r is HybridFaceMatchResult => r != null)
    .sort((a, b) => b.confidencePercent - a.confidencePercent);
  if (failed[0]) return { ...failed[0], matched: false };

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

/** previewUrl 있는 기존 등록에 descriptorV2 일괄 채움 (InsightFace 활성 시) */
export async function backfillDescriptorV2FromPreviews(limit = 50): Promise<{
  processed: number;
  updated: number;
  skipped: number;
}> {
  if (!isFaceEmbedServiceConfigured()) {
    return { processed: 0, updated: 0, skipped: 0 };
  }
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.employeeFaceCredential.findMany({
    where: { previewUrl: { not: null } },
    select: { id: true, previewUrl: true, descriptorV2: true },
    take: Math.min(400, Math.max(1, limit * 3)),
    orderBy: { createdAt: "desc" },
  });

  const targets = rows
    .filter((r) => parseDescriptorV2(r.descriptorV2) == null)
    .slice(0, Math.min(200, Math.max(1, limit)));

  let updated = 0;
  let skipped = 0;
  for (const row of targets) {
    const r = await attachDescriptorV2ToCredentials([row.id], row.previewUrl);
    if (r.ok) updated += 1;
    else skipped += 1;
  }
  return { processed: targets.length, updated, skipped };
}
