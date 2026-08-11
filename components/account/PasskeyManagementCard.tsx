"use client";

import { useI18n } from "@/components/LanguageProvider";
import {
  bannerInfo,
  bannerSuccess,
  btnPrimary,
  btnSecondary,
  card,
  cardBody,
  cardHeader,
  errorText,
  hint,
} from "@/lib/uiStyles";
import { startRegistration } from "@simplewebauthn/browser";
import { useCallback, useEffect, useMemo, useState } from "react";

type PasskeyItem = {
  id: string;
  nickname: string | null;
  deviceType: string | null;
  transports: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export function PasskeyManagementCard() {
  const { t } = useI18n();
  const [items, setItems] = useState<PasskeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const supported = useMemo(
    () => typeof window !== "undefined" && typeof window.PublicKeyCredential !== "undefined",
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/user/passkeys");
      const j = (await r.json().catch(() => ({}))) as { credentials?: PasskeyItem[] };
      if (!r.ok) {
        setError(t("account.passkeyLoadFail"));
      } else {
        setItems(Array.isArray(j.credentials) ? j.credentials : []);
      }
    } catch {
      setError(t("account.passkeyLoadFail"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function registerPasskey() {
    if (!supported) {
      setError(t("account.passkeyNotSupported"));
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const optionsRes = await fetch("/api/user/passkeys/register/options", { method: "POST" });
      const optionsJson = (await optionsRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!optionsRes.ok) {
        setError(t("account.passkeyRegisterFail"));
        return;
      }

      const response = await startRegistration(
        optionsJson as unknown as Parameters<typeof startRegistration>[0]
      );
      const verifyRes = await fetch("/api/user/passkeys/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (!verifyRes.ok) {
        setError(t("account.passkeyRegisterFail"));
        return;
      }
      setSuccess(t("account.passkeyRegistered"));
      await load();
    } catch {
      setError(t("account.passkeyRegisterFail"));
    } finally {
      setBusy(false);
    }
  }

  async function deletePasskey(id: string) {
    if (!window.confirm(t("account.passkeyDeleteConfirm"))) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const r = await fetch("/api/user/passkeys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) {
        setError(t("account.passkeyDeleteFail"));
        return;
      }
      setSuccess(t("account.passkeyDeleted"));
      await load();
    } catch {
      setError(t("account.passkeyDeleteFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card}>
      <div className={cardHeader}>
        <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{t("account.passkeyTitle")}</p>
        <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">{t("account.passkeyLead")}</p>
      </div>
      <div className={`${cardBody} space-y-4`}>
        {!supported ? <p className={bannerInfo}>{t("account.passkeyNotSupported")}</p> : null}
        {loading ? <p className={hint}>{t("common.loading")}</p> : null}
        {error ? <p className={errorText}>{error}</p> : null}
        {success ? <p className={bannerSuccess}>{success}</p> : null}

        {!loading && supported && items.length === 0 ? (
          <p className={hint}>{t("account.passkeyNone")}</p>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[var(--separator)] bg-[var(--fill-tertiary)] px-3 py-2.5"
              >
                <p className="text-[0.8125rem] font-semibold text-[var(--foreground)]">
                  {item.nickname || t("account.passkeyDefaultName")}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-[var(--apple-label-secondary)]">
                  {t("account.passkeyLastUsed").replace(
                    "{time}",
                    item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString() : "-"
                  )}
                </p>
                <div className="mt-2">
                  <button
                    type="button"
                    className={`${btnSecondary} h-8 px-3 text-[0.75rem]`}
                    onClick={() => void deletePasskey(item.id)}
                    disabled={busy}
                  >
                    {t("account.passkeyDelete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!supported || busy}
          className={`${btnPrimary} w-full sm:w-auto`}
          onClick={() => void registerPasskey()}
        >
          {busy ? t("account.passkeyRegistering") : t("account.passkeyRegister")}
        </button>
      </div>
    </section>
  );
}

