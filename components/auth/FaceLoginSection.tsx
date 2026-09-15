"use client";

import { FaceCapture } from "@/components/employee/FaceCapture";
import { authError, authFieldGroup, authHint, authInput, authLabel } from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { staySignedInCredentialValue } from "@/lib/clientPlatform";
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
  const retryBlockedUntilRef = useRef(0);
  const LOGIN_TIMEOUT_MS = 12_000;
  const FAILED_RETRY_COOLDOWN_MS = 5_000;
  const [companyName, setCompanyName] = useState("");
  const trimmedCompany = companyName.trim();
  const faceReady = trimmedCompany.length > 0;

  function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), timeoutMs);
      promise
        .then((value) => {
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((error: unknown) => {
          window.clearTimeout(timer);
          reject(error);
        });
    });
  }

  const handleVerified = useCallback(
    async (descriptor: number[], context?: { frameDescriptors?: number[][] }) => {
      if (signInStartedRef.current || disabled || !trimmedCompany) return false;
      if (Date.now() < retryBlockedUntilRef.current) return false;

      const frames = context?.frameDescriptors?.filter((f) => f.length > 0) ?? [];
      if (frames.length < 3) {
        onError(t("login.errorFaceCredentials"));
        return false;
      }

      signInStartedRef.current = true;

      try {
        const matchRes = await withTimeout(
          fetch("/api/public/face-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              faceDescriptors: frames.slice(0, 8),
              companyName: trimmedCompany,
            }),
          }),
          LOGIN_TIMEOUT_MS
        );
        const matchBody = (await matchRes.json().catch(() => ({}))) as {
          loginToken?: string;
          error?: string;
          retryAfterMs?: number;
        };

        if (!matchRes.ok) {
          signInStartedRef.current = false;
          if (matchRes.status === 429) {
            retryBlockedUntilRef.current =
              Date.now() + Math.max(matchBody.retryAfterMs ?? 0, 15_000);
            onError(t("login.errorFaceRateLimit"));
          } else if (matchBody.error === "missing_name") {
            retryBlockedUntilRef.current = Date.now() + FAILED_RETRY_COOLDOWN_MS;
            onError(t("login.faceCompanyRequired"));
          } else if (matchBody.error === "not_found") {
            retryBlockedUntilRef.current = Date.now() + FAILED_RETRY_COOLDOWN_MS;
            onError(t("login.errorFaceCompanyNotFound"));
          } else if (matchBody.error === "ambiguous") {
            retryBlockedUntilRef.current = Date.now() + FAILED_RETRY_COOLDOWN_MS;
            onError(t("login.errorFaceAmbiguous"));
          } else if (matchBody.error === "no_enrolled") {
            retryBlockedUntilRef.current = Date.now() + FAILED_RETRY_COOLDOWN_MS;
            onError(t("login.errorFaceNoEnrolled"));
          } else {
            retryBlockedUntilRef.current = Date.now() + FAILED_RETRY_COOLDOWN_MS;
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

        onError(null);
        onLoadingChange(true);
        const res = await withTimeout(
          signIn("face-login", {
            loginToken,
            staySignedIn: staySignedInCredentialValue(),
            redirect: false,
            callbackUrl,
          }),
          LOGIN_TIMEOUT_MS
        );
        if (res?.error) {
          signInStartedRef.current = false;
          onError(t("login.errorFaceCredentials"));
          return false;
        }
        window.location.href = callbackUrl;
        return true;
      } catch (err) {
        signInStartedRef.current = false;
        if (err instanceof Error && err.message === "REQUEST_TIMEOUT") {
          onError(t("login.errorFaceCredentials"));
          return false;
        }
        onError(t("login.errorFaceCredentials"));
        return false;
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
            retryBlockedUntilRef.current = 0;
            onError(null);
          }}
        />
        <p className={authHint}>{t("login.faceCompanyHint")}</p>
      </div>
      {error && <p className={authError}>{error}</p>}
      {faceReady ? (
        <FaceCapture
          key={trimmedCompany.toLowerCase()}
          mode="verify"
          autoVerify
          verifyOnClientOnly
          highAccuracyScan
          fastScan
          scanWhenFaceVisible
          blockRetryUntilFaceAbsent={false}
          profileKind="login"
          disabled={disabled}
          verifyTitle={t("login.faceVerifyTitle")}
          verifyLead={t("login.faceVerifyLead")}
          verifyRetryLabel={t("login.faceVerifyRetry")}
          onVerified={handleVerified}
          onError={(message) => onError(message)}
        />
      ) : (
        <p className={authHint}>{t("login.faceEnterCompanyToStart")}</p>
      )}
    </>
  );
}
