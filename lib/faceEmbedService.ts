/**
 * 서버 사이드 InsightFace(또는 호환) 임베딩 서비스 클라이언트.
 * FACE_EMBED_SERVICE_URL 이 없으면 비활성 — 기존 face-api 128-d 경로만 사용.
 */

export const FACE_EMBED_MODEL_DEFAULT = "insightface-buffalo_l";

export function isFaceEmbedServiceConfigured(): boolean {
  return Boolean(process.env.FACE_EMBED_SERVICE_URL?.trim());
}

export function faceEmbedServiceBaseUrl(): string | null {
  const raw = process.env.FACE_EMBED_SERVICE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function embedAuthHeaders(): HeadersInit {
  const secret = process.env.FACE_EMBED_SERVICE_SECRET?.trim();
  if (!secret) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
}

export type FaceEmbedResult = {
  embedding: number[];
  model: string;
  dim: number;
};

/** data URL 또는 raw base64 JPEG/PNG → 512-d 임베딩 */
export async function requestFaceEmbedding(imageDataUrl: string): Promise<FaceEmbedResult | null> {
  const base = faceEmbedServiceBaseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${base}/v1/embed`, {
      method: "POST",
      headers: embedAuthHeaders(),
      body: JSON.stringify({ image: imageDataUrl }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      embedding?: number[];
      model?: string;
      dim?: number;
    };
    if (!Array.isArray(j.embedding) || j.embedding.length < 64) return null;
    if (!j.embedding.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    return {
      embedding: j.embedding,
      model: typeof j.model === "string" ? j.model : FACE_EMBED_MODEL_DEFAULT,
      dim: typeof j.dim === "number" ? j.dim : j.embedding.length,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 코사인 유사도 (L2 정규화 벡터 가정) — 1에 가까울수록 동일인 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom < 1e-12) return -1;
  return dot / denom;
}

export function faceEmbedMatchThreshold(): number {
  const raw = process.env.FACE_EMBED_MATCH_THRESHOLD?.trim();
  if (!raw) return 0.38;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0.38;
}

export function parseDescriptorV2(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 64) return null;
  const out: number[] = [];
  for (const v of raw) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    out.push(v);
  }
  return out;
}

export type ServerFaceMatchResult = {
  matched: boolean;
  bestSimilarity: number;
  confidencePercent: number;
  model: string;
};

/** probe 임베딩 vs 저장된 descriptorV2 목록 */
export function matchDescriptorV2Gallery(
  gallery: number[][],
  probe: number[],
  threshold = faceEmbedMatchThreshold()
): ServerFaceMatchResult {
  let best = -1;
  for (const g of gallery) {
    const s = cosineSimilarity(g, probe);
    if (s > best) best = s;
  }
  const matched = best >= threshold;
  const confidencePercent = Math.max(
    0,
    Math.min(100, Math.round(((best - (threshold - 0.15)) / 0.3) * 100))
  );
  return {
    matched,
    bestSimilarity: best,
    confidencePercent: matched ? Math.max(confidencePercent, 50) : confidencePercent,
    model: FACE_EMBED_MODEL_DEFAULT,
  };
}
