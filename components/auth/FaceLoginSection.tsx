"use client";

import { FaceCapture } from "@/components/employee/FaceCapture";
import { authError } from "@/components/auth/authStyles";
import { useI18n } from "@/components/LanguageProvider";
import { prefetchFaceRecognition } from "@/lib/faceRecognitionClient";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useRef } from "react";

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

  useEffect(() => {
    prefetchFaceRecognition(true);
  }, []);

  const handleVerified = useCallback(
    async (descriptor: number[]) => {
      if (signInStartedRef.current || disabled) return false;
      signInStartedRef.current = true;
      onError(null);
      onLoadingChange(true);
      const res = await signIn("face-login", {
        descriptor: JSON.stringify(descriptor),
        redirect: false,
        callbackUrl,
      });
      onLoadingChange(false);
      if (res?.error) {
        signInStartedRef.current = false;
        onError(t("login.errorFaceCredentials"));
        return false;
      }
      window.location.href = callbackUrl;
      return true;
    },
    [callbackUrl, disabled, onError, onLoadingChange, t]
  );

  return (
    <>
      {error && <p className={authError}>{error}</p>}
      <FaceCapture
        mode="verify"
        autoVerify
        verifyOnClientOnly
        disabled={disabled}
        verifyTitle={t("login.faceVerifyTitle")}
        verifyLead={t("login.faceVerifyLead")}
        onVerified={handleVerified}
        onError={(message) => onError(message)}
      />
    </>
  );
}
