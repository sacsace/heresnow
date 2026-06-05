"use client";

import { AppleAlertDialog } from "@/components/ui/AppleAlertDialog";
import { useI18n } from "@/components/LanguageProvider";
import { btnPrimary } from "@/lib/uiStyles";
import type { UsageBillingBreakdown } from "@/lib/pricing";
import { useCallback, useState } from "react";

type RazorpayHandlerResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayHandlerResponse) => void;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, cb: () => void) => void;
    };
  }
}

type Props = {
  employeeCount: number;
  months: number;
  bill: UsageBillingBreakdown | null;
  companyName: string;
  userEmail?: string | null;
  disabled?: boolean;
  onPaid?: () => void;
  className?: string;
};

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script load failed")));
      if (window.Razorpay) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script load failed"));
    document.body.appendChild(script);
  });
}

export function RazorpayPayButton({
  employeeCount,
  months,
  bill,
  companyName,
  userEmail,
  disabled,
  onPaid,
  className,
}: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paySuccessOpen, setPaySuccessOpen] = useState(false);

  const pay = useCallback(async () => {
    if (busy || disabled || !bill || bill.total <= 0) return;
    setError(null);
    setBusy(true);
    try {
      await loadRazorpayScript();
      const r = await fetch("/api/admin/billing/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCount, months }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        orderId?: string;
        amountPaise?: number;
        currency?: string;
        keyId?: string;
        paymentOrderId?: string;
        registeredCount?: number;
        billableEmployeeCount?: number;
      };
      if (!r.ok) {
        setError(
          j.code === "BILLING_PROFILE_INCOMPLETE"
            ? t("admin.billingProfileRequiredForPay")
            : j.code === "HEADCOUNT_BELOW_REGISTERED"
              ? t("admin.billingHeadcountBelowRegistered").replace(
                  "{n}",
                  String(j.billableEmployeeCount ?? j.registeredCount ?? employeeCount)
                )
              : typeof j.error === "string"
                ? j.error
                : t("admin.billingPayFail")
        );
        setBusy(false);
        return;
      }
      if (!j.orderId || !j.keyId || !j.paymentOrderId || j.amountPaise == null) {
        setError(t("admin.billingPayFail"));
        setBusy(false);
        return;
      }

      const RazorpayCtor = window.Razorpay;
      if (!RazorpayCtor) {
        setError(t("admin.billingPayFail"));
        setBusy(false);
        return;
      }

      const rzp = new RazorpayCtor({
        key: j.keyId,
        amount: j.amountPaise,
        currency: j.currency ?? "INR",
        name: "HeresNow",
        description: companyName,
        order_id: j.orderId,
        prefill: userEmail ? { email: userEmail } : undefined,
        theme: { color: "#0071e3" },
        handler: async (response) => {
          try {
            const vr = await fetch("/api/admin/billing/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentOrderId: j.paymentOrderId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const vj = await vr.json().catch(() => ({}));
            if (!vr.ok) {
              setError(
                typeof vj.error === "string" ? vj.error : t("admin.billingPayVerifyFail")
              );
              return;
            }
            setPaySuccessOpen(true);
            onPaid?.();
          } catch {
            setError(t("admin.billingPayVerifyFail"));
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });
      rzp.on("payment.failed", () => {
        setError(t("admin.billingPayFail"));
        setBusy(false);
      });
      rzp.open();
    } catch {
      setError(t("admin.billingPayFail"));
      setBusy(false);
    }
  }, [bill, busy, companyName, disabled, employeeCount, months, onPaid, t, userEmail]);

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy || disabled || !bill || bill.total <= 0}
        onClick={() => void pay()}
        className={
          btnPrimary + " w-full min-h-[3rem] py-3 text-[1rem] font-semibold sm:min-h-[3.25rem]"
        }
      >
        {busy ? t("admin.billingPayProcessing") : t("admin.billingPayButton")}
      </button>
      {error && (
        <p className="mt-2 text-center text-[0.8125rem] text-[var(--apple-red)]">{error}</p>
      )}
      <AppleAlertDialog
        open={paySuccessOpen}
        title={t("admin.billingPaySuccessTitle")}
        message={t("admin.billingPaySuccess")}
        onClose={() => setPaySuccessOpen(false)}
      />
    </div>
  );
}
