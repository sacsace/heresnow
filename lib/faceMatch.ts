/** face-api.js 유클리드 거리 기준 (낮을수록 동일인) — 1:1 출퇴근 검증 */
export const FACE_MATCH_THRESHOLD = 0.48;

/** 로그인 1:N — 회사 범위 1:N + minGap (출근보다 약간 여유) */
export const FACE_MATCH_THRESHOLD_LOGIN = 0.55;

/** 로그인 — 매우 확실할 때 모호성 검사 생략 */
export const FACE_MATCH_THRESHOLD_LOGIN_CONFIDENT = 0.42;

/** 출입문 단말 — 고정 카메라·다중 프레임 평균과 함께 사용 */
export const FACE_MATCH_THRESHOLD_DOOR = 0.45;

export const FACE_DESCRIPTOR_LENGTH = 128;

function l2Normalize(values: number[]): number[] | null {
  let normSq = 0;
  for (const v of values) normSq += v * v;
  const norm = Math.sqrt(normSq);
  if (!Number.isFinite(norm) || norm <= 0) return null;
  return values.map((v) => v / norm);
}

export function parseFaceDescriptor(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length !== FACE_DESCRIPTOR_LENGTH) return null;
  const arr = raw.map((v) => Number(v));
  if (arr.some((n) => !Number.isFinite(n))) return null;
  return l2Normalize(arr);
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

/** 유클리드 거리 → 인식률 % (0=불일치, threshold=0%, distance=0→100%) */
export function distanceToConfidencePercent(
  distance: number,
  threshold = FACE_MATCH_THRESHOLD
): number {
  if (!Number.isFinite(distance)) return 0;
  const raw = (1 - distance / threshold) * 100;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

/** 여러 descriptor 중 probe와 최소 거리 */
export function bestProbeDistance(descriptors: number[][], probe: number[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const stored of descriptors) {
    const d = euclideanDistance(stored, probe);
    if (d < best) best = d;
  }
  return best;
}

export type MultiFaceDescriptorCandidate = {
  id: string;
  descriptors: number[][];
};

/** 후보별 다중 descriptor — 각 후보의 최소 거리로 1:N 식별 */
export function identifySingleFaceMatchMulti<T extends MultiFaceDescriptorCandidate>(
  candidates: T[],
  probe: number[],
  threshold = FACE_MATCH_THRESHOLD,
  minGap = FACE_IDENTIFY_MIN_GAP
): FaceIdentifyResult<T> | null {
  const matches: { candidate: T; distance: number }[] = [];
  for (const candidate of candidates) {
    if (candidate.descriptors.length === 0) continue;
    const distance = bestProbeDistance(candidate.descriptors, probe);
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

/** 1:N 식별 시 1·2위 거리 차이가 이보다 작으면 동일인으로 확정하지 않음 */
export const FACE_IDENTIFY_MIN_GAP = 0.08;

/** 로그인 1:N — 2명 이상 근접 매칭 시 최소 격차 */
export const FACE_IDENTIFY_MIN_GAP_LOGIN = 0.05;

export const FACE_IDENTIFY_MIN_GAP_DOOR = 0.12;

export type FaceIdentifyCandidate = {
  id: string;
  faceDescriptor: unknown;
};

export type FaceIdentifyResult<T> = {
  match: T;
  distance: number;
};

export type ParsedFaceIdentifyCandidate = {
  id: string;
  descriptor: number[];
};

export function identifySingleFaceMatchParsed<T extends ParsedFaceIdentifyCandidate>(
  candidates: T[],
  probe: number[],
  threshold = FACE_MATCH_THRESHOLD,
  minGap = FACE_IDENTIFY_MIN_GAP
): FaceIdentifyResult<T> | null {
  const matches: { candidate: T; distance: number }[] = [];
  for (const candidate of candidates) {
    if (candidate.descriptor.length !== FACE_DESCRIPTOR_LENGTH) continue;
    const distance = euclideanDistance(candidate.descriptor, probe);
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

/** 연속 프레임 descriptor 평균 후 L2 정규화 (노이즈 감소) */
export function averageFaceDescriptors(descriptors: number[][]): number[] | null {
  if (descriptors.length === 0) return null;
  const len = FACE_DESCRIPTOR_LENGTH;
  const sum = new Array<number>(len).fill(0);
  let count = 0;

  for (const d of descriptors) {
    if (d.length !== len || d.some((n) => !Number.isFinite(n))) continue;
    for (let i = 0; i < len; i++) sum[i]! += d[i]!;
    count += 1;
  }
  if (count === 0) return null;

  const avg = sum.map((v) => v / count);
  let normSq = 0;
  for (const v of avg) normSq += v * v;
  const norm = Math.sqrt(normSq);
  if (!Number.isFinite(norm) || norm === 0) return null;
  return avg.map((v) => v / norm);
}
