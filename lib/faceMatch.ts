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
