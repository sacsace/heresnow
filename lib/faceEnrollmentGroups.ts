/** 계정당 등록 가능한 안면(배치) 수 */
export const MAX_FACE_ENROLLMENTS = 3;

export type FaceCredentialGroupingInput = {
  id: string;
  createdAt: string;
  lastUsedAt: string | null;
  hasPreview: boolean;
  batchId?: string | null;
};

export type FaceEnrollmentGroup = {
  key: string;
  batchId: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  hasPreview: boolean;
  previewCredentialId: string | null;
  sampleCount: number;
};

export function groupFaceCredentials(
  items: FaceCredentialGroupingInput[]
): FaceEnrollmentGroup[] {
  const map = new Map<string, FaceEnrollmentGroup>();
  for (const item of items) {
    const key = item.batchId ?? item.id;
    const existing = map.get(key);
    if (existing) {
      existing.sampleCount += 1;
      if (item.hasPreview) {
        existing.hasPreview = true;
        existing.previewCredentialId = item.id;
      }
      if (
        item.lastUsedAt &&
        (!existing.lastUsedAt || item.lastUsedAt > existing.lastUsedAt)
      ) {
        existing.lastUsedAt = item.lastUsedAt;
      }
    } else {
      map.set(key, {
        key,
        batchId: item.batchId ?? null,
        createdAt: item.createdAt,
        lastUsedAt: item.lastUsedAt,
        hasPreview: item.hasPreview,
        previewCredentialId: item.hasPreview ? item.id : null,
        sampleCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function countFaceEnrollmentGroups(items: FaceCredentialGroupingInput[]): number {
  return groupFaceCredentials(items).length;
}

export function faceEnrollmentGridCols(count: number): string {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  return "grid-cols-3";
}
