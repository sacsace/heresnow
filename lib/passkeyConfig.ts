const FALLBACK_RP_NAME = "HeresNow";

function normalizeUrl(value: string | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function resolvePasskeyConfig(req: Request): {
  rpName: string;
  rpID: string;
  expectedOrigin: string[];
} {
  const requestUrl = new URL(req.url);
  const requestOrigin = `${requestUrl.protocol}//${requestUrl.host}`;
  const canonicalOrigin =
    normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? normalizeUrl(process.env.AUTH_URL);
  const rpName = (process.env.PASSKEY_RP_NAME ?? FALLBACK_RP_NAME).trim() || FALLBACK_RP_NAME;

  const configuredRpId = (process.env.PASSKEY_RP_ID ?? "").trim();
  const rpID = configuredRpId || (canonicalOrigin ? new URL(canonicalOrigin).hostname : requestUrl.hostname);

  const expectedOrigin = Array.from(
    new Set([requestOrigin, canonicalOrigin].filter((v): v is string => Boolean(v)))
  );

  return { rpName, rpID, expectedOrigin };
}

