import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

/** MVS(또는 연동 배치)가 HeresNow API를 호출할 때 사용하는 공유 키 */
export function verifyMvsIntegrationApiKey(headerValue: string | null): boolean {
  const expected = process.env.MVS_INTEGRATION_API_KEY?.trim();
  if (!expected) return false;
  const provided = headerValue?.trim();
  if (!provided) return false;
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function hmacSha256Hex(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

function mvsApiKeyPepper(): string | null {
  const explicit = process.env.MVS_API_KEY_PEPPER?.trim();
  if (explicit) return explicit;
  const fallback = process.env.AUTH_SECRET?.trim();
  return fallback || null;
}

/** 회사별 MVS API key (DB 저장용 해시) */
export function hashMvsApiKey(raw: string): string {
  const pepper = mvsApiKeyPepper();
  // v2: HMAC-SHA256(pepper). pepper가 없으면 레거시 sha256 포맷 유지.
  if (!pepper) return sha256Hex(raw);
  return `v2:${hmacSha256Hex(raw, pepper)}`;
}

export function verifyMvsApiKeyHash(
  headerValue: string | null,
  expectedHash: string | null | undefined
): boolean {
  if (!expectedHash) return false;
  const provided = headerValue?.trim();
  if (!provided) return false;
  try {
    const normalizedExpected = expectedHash.trim();
    let normalizedProvided: string;
    if (normalizedExpected.startsWith("v2:")) {
      const pepper = mvsApiKeyPepper();
      if (!pepper) return false;
      normalizedProvided = `v2:${hmacSha256Hex(provided, pepper)}`;
    } else {
      // 레거시 저장 포맷(plain sha256) 하위호환
      normalizedProvided = sha256Hex(provided);
    }

    const a = Buffer.from(normalizedProvided, "utf8");
    const b = Buffer.from(normalizedExpected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** 48자 hex 키 생성 (예: MVS_INTEGRATION_API_KEY 값) */
export function generateMvsApiKey(): string {
  return randomBytes(24).toString("hex");
}

export function verifyIntegrationDispatchSecret(headerValue: string | null): boolean {
  const expected = process.env.INTEGRATION_DISPATCH_SECRET?.trim();
  if (!expected) return false;
  const provided = headerValue?.trim();
  if (!provided) return false;
  try {
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
