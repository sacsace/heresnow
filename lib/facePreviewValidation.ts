const MAX_FACE_PREVIEW_URL_LENGTH = 1_000_000;

const FACE_PREVIEW_URL_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export function isValidFacePreviewUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length > MAX_FACE_PREVIEW_URL_LENGTH) return false;
  return FACE_PREVIEW_URL_RE.test(value);
}
