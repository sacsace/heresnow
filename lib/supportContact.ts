/** HeresNow 고객센터 문의 이메일 */
export const SUPPORT_EMAIL = "info@msventures.in";

export function supportMailtoUrl(locale: "ko" | "en"): string {
  const subject = locale === "ko" ? "HeresNow 문의" : "HeresNow Support Inquiry";
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SUPPORT_SMTP_HOST?.trim() &&
      process.env.SUPPORT_SMTP_USER?.trim() &&
      process.env.SUPPORT_SMTP_PASS?.trim()
  );
}

export function isSupportEmailConfigured(): boolean {
  return isSmtpConfigured();
}

export function getSupportToEmail(): string {
  return process.env.SUPPORT_TO_EMAIL?.trim() || SUPPORT_EMAIL;
}

export function getSmtpFromAddress(): string {
  const from = process.env.SUPPORT_SMTP_FROM?.trim();
  if (from) return from;
  const user = process.env.SUPPORT_SMTP_USER?.trim();
  if (user) return `"HeresNow Support" <${user}>`;
  return `"HeresNow Support" <${SUPPORT_EMAIL}>`;
}
