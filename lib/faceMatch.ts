/** face-api.js 유클리드 거리 기준 (낮을수록 동일인) */
export const FACE_MATCH_THRESHOLD = 0.55;

export const FACE_DESCRIPTOR_LENGTH = 128;

export function parseFaceDescriptor(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== FACE_DESCRIPTOR_LENGTH) return null;
  const arr = raw.map((v) => Number(v));
  if (arr.some((n) => !Number.isFinite(n))) return null;
  return arr;
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isFaceMatch(stored: number[], probe: number[], threshold = FACE_MATCH_THRESHOLD): boolean {
  return euclideanDistance(stored, probe) < threshold;
}

/** 1:N 식별 시 1·2위 거리 차이가 이보다 작으면 동일인으로 확정하지 않음 */
export const FACE_IDENTIFY_MIN_GAP = 0.06;

export type FaceIdentifyCandidate = {
  id: string;
  faceDescriptor: unknown;
};

export type FaceIdentifyResult<T extends FaceIdentifyCandidate> = {
  match: T;
  distance: number;
};

/** 등록된 후보 중 probe와 일치하는 단일 후보를 찾음. 모호하면 null */
export function identifySingleFaceMatch<T extends FaceIdentifyCandidate>(
  candidates: T[],
  probe: number[],
  threshold = FACE_MATCH_THRESHOLD,
  minGap = FACE_IDENTIFY_MIN_GAP
): FaceIdentifyResult<T> | null {
  const matches: { candidate: T; distance: number }[] = [];
  for (const candidate of candidates) {
    const stored = parseFaceDescriptor(candidate.faceDescriptor);
    if (!stored) continue;
    const distance = euclideanDistance(stored, probe);
    if (distance < threshold) {
      matches.push({ candidate, distance });
    }
  }
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.distance - b.distance);
  const best = matches[0]!;
  if (matches.length > 1 && best.distance + minGap > matches[1]!.distance) {
    return null;
  }
  return { match: best.candidate, distance: best.distance };
}
