import Razorpay from "razorpay";

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() &&
      process.env.RAZORPAY_KEY_SECRET?.trim() &&
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim()
  );
}

export function getPublicRazorpayKeyId(): string | null {
  const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  return key || null;
}

let client: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured");
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!.trim(),
      key_secret: process.env.RAZORPAY_KEY_SECRET!.trim(),
    });
  }
  return client;
}

/** Rs 정수 → Razorpay paise */
export function rupeesToPaise(amountRs: number): number {
  return Math.max(0, Math.round(amountRs * 100));
}
