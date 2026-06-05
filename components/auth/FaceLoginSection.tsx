"use client";

import { FaceCapture } from "@/components/employee/FaceCapture";
import { authError, authFieldGroup, authHint, authInput, authLabel } from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { signIn } from "next-auth/react";
import { useCallback, useRef, useState } from "react";

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
  const trimmedCompany = companyName.trim();
  const faceReady = trimmedCompany.length > 0;

  const handleVerified = useCallback(
    async (descriptor: number[]) => {
      if (signInStartedRef.current || disabled || !trimmedCompany) return false;

      signInStartedRef.current = true;
      onError(null);
      onLoadingChange(true);

      try {
        const matchRes = await fetch("/api/public/face-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descriptor,
            companyName: trimmedCompany,
          }),
        });
        const matchBody = (await matchRes.json().catch(() => ({}))) as {
          loginToken?: string;
          error?: string;
        };

        if (!matchRes.ok) {
          signInStartedRef.current = false;
          if (matchRes.status === 429) {
            onError(t("login.errorFaceRateLimit"));
          } else if (matchBody.error === "missing_name") {
            onError(t("login.faceCompanyRequired"));
          } else if (matchBody.error === "not_found") {
            onError(t("login.errorFaceCompanyNotFound"));
          } else if (matchBody.error === "ambiguous") {
            onError(t("login.errorFaceCompanyAmbiguous"));
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
    [callbackUrl, disabled, onError, onLoadingChange, t, trimmedCompany]
  );

  return (
    <>
      <div className={authFieldGroup}>
        <label className={authLabel}>{t("login.faceCompanyName")}</label>
        <input
          type="text"
          autoComplete="organization"
          className={authInput}
          value={companyName}
          onChange={(e) => {
            setCompanyName(e.target.value);
            signInStartedRef.current = false;
            onError(null);
          }}
          required
        />
        <p className={authHint}>
          {faceReady ? t("login.faceCompanyHint") : t("login.faceEnterCompanyToStart")}
        </p>
      </div>
      {error && <p className={authError}>{error}</p>}
      {faceReady ? (
        <FaceCapture
          key={trimmedCompany.toLowerCase()}
          mode="verify"
          autoVerify
          verifyOnClientOnly
          fastScan
          disabled={disabled}
          verifyTitle={t("login.faceVerifyTitle")}
          verifyLead={t("login.faceVerifyLead")}
          onVerified={handleVerified}
          onError={(message) => onError(message)}
        />
      ) : null}
    </>
  );
}
