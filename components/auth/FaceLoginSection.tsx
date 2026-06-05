"use client";

import { FaceCapture } from "@/components/employee/FaceCapture";
import { authError, authFieldGroup, authHint, authInput, authLabel } from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  callbackUrl: string;
  disabled?: boolean;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string | null) => void;
  error: string | null;
};

export function FaceLoginSection({
  callbackUrl,
  disabled,
  onLoadingChange,
  onError,
  error,
}: Props) {
  const { t } = useI18n();
  const signInStartedRef = useRef(false);
  const [companyName, setCompanyName] = useState("");
  const [requireCompanyName, setRequireCompanyName] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/public/face-login/config")
      .then(async (r) => {
        const data = (await r.json()) as { requireCompanyName?: boolean };
        if (!cancelled) setRequireCompanyName(Boolean(data.requireCompanyName));
      })
      .catch(() => {
        if (!cancelled) setRequireCompanyName(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleVerified = useCallback(
    async (descriptor: number[]) => {
      if (signInStartedRef.current || disabled) return false;
      if (requireCompanyName === null) return false;

      if (requireCompanyName && !companyName.trim()) {
        onError(t("login.faceCompanyRequired"));
        return false;
      }

      signInStartedRef.current = true;
      onError(null);
      onLoadingChange(true);

      try {
        const matchRes = await fetch("/api/public/face-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descriptor,
            companyName: companyName.trim() || undefined,
          }),
        });
        const matchBody = (await matchRes.json().catch(() => ({}))) as {
          loginToken?: string;
          error?: string;
          retryAfterMs?: number;
        };

        if (!matchRes.ok) {
          signInStartedRef.current = false;
          if (matchRes.status === 429) {
            onError(t("login.errorFaceRateLimit"));
          } else if (matchBody.error === "missing_name") {
            onError(t("login.faceCompanyRequired"));
          } else if (matchBody.error === "not_found") {
            onError(t("login.errorFaceCompanyNotFound"));
          } else {
            onError(t("login.errorFaceCredentials"));
          }
          return false;
        }

        const loginToken = matchBody.loginToken;
        if (!loginToken) {
          signInStartedRef.current = false;
          onError(t("login.errorFaceCredentials"));
          return false;
        }

        const res = await signIn("face-login", {
          loginToken,
          redirect: false,
          callbackUrl,
        });
        if (res?.error) {
          signInStartedRef.current = false;
          onError(t("login.errorFaceCredentials"));
          return false;
        }
        window.location.href = callbackUrl;
        return true;
      } finally {
        onLoadingChange(false);
      }
    },
    [
      callbackUrl,
      companyName,
      disabled,
      onError,
      onLoadingChange,
      requireCompanyName,
      t,
    ]
  );

  return (
    <>
      {requireCompanyName === true && (
        <div className={authFieldGroup}>
          <label className={authLabel}>{t("login.faceCompanyName")}</label>
          <input
            type="text"
            autoComplete="organization"
            className={authInput}
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              onError(null);
            }}
            required
          />
          <p className={authHint}>{t("login.faceCompanyHint")}</p>
        </div>
      )}
      {error && <p className={authError}>{error}</p>}
      <FaceCapture
        mode="verify"
        autoVerify
        verifyOnClientOnly
        fastScan
        disabled={disabled || requireCompanyName === null}
        verifyTitle={t("login.faceVerifyTitle")}
        verifyLead={t("login.faceVerifyLead")}
        onVerified={handleVerified}
        onError={(message) => onError(message)}
      />
    </>
  );
}
