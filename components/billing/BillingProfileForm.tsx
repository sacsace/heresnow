"use client";

import { DEFAULT_COMPANY_BILLING_EMAIL } from "@/lib/companyBillingProfile";
import { useI18n } from "@/components/LanguageProvider";
import {
  btnPrimary,
  card,
  cardBodyCompact,
  errorText,
  hint,
  inputCompact,
  sectionLabel,
  successText,
} from "@/lib/uiStyles";
import { useCallback, useEffect, useState } from "react";

const fieldLabel =
  "block text-[0.8125rem] font-medium text-[var(--apple-label-secondary)] mb-1";
const fieldInput = `${inputCompact} w-full min-h-[2.25rem]`;

export type BillingProfileState = {
  legalName: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  gstin: string;
  email: string;
  phone: string;
  complete: boolean;
};

type Props = {
  canEdit: boolean;
  initial?: BillingProfileState | null;
  onSaved?: (profile: BillingProfileState) => void;
};

const emptyForm = (): Omit<BillingProfileState, "complete"> => ({
  legalName: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
  gstin: "",
  email: DEFAULT_COMPANY_BILLING_EMAIL,
  phone: "",
});

export function BillingProfileForm({ canEdit, initial, onSaved }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState(emptyForm());
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const applyProfile = useCallback((p: BillingProfileState) => {
    setForm({
      legalName: p.legalName,
      address: p.address,
      city: p.city,
      state: p.state,
      postalCode: p.postalCode,
      country: p.country || "India",
      gstin: p.gstin ?? "",
      email: p.email,
      phone: p.phone ?? "",
    });
    setComplete(p.complete);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await fetch("/api/admin/billing/profile");
    const j = (await r.json().catch(() => ({}))) as {
      error?: string;
      billingProfile?: BillingProfileState;
    };
    setLoading(false);
    if (!r.ok) {
      setError(typeof j.error === "string" ? j.error : t("admin.billingProfileLoadFail"));
      return;
    }
    const p = j.billingProfile;
    if (!p) {
      setError(t("admin.billingProfileLoadFail"));
      return;
    }
    applyProfile(p);
    onSaved?.(p);
  }, [applyProfile, onSaved, t]);

  useEffect(() => {
    if (initial) {
      applyProfile(initial);
      setLoading(false);
      return;
    }
    void load();
  }, [initial, applyProfile, load]);

  useEffect(() => {
    if (initial) applyProfile(initial);
  }, [initial, applyProfile]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const r = await fetch("/api/admin/billing/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalName: form.legalName,
        address: form.address,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        country: form.country,
        gstin: form.gstin.trim() || null,
        email: form.email,
        phone: form.phone.trim() || null,
      }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      error?: string;
      billingProfile?: BillingProfileState;
    };
    setSaving(false);
    if (!r.ok) {
      setError(typeof j.error === "string" ? j.error : t("admin.billingProfileSaveFail"));
      return;
    }
    const p = j.billingProfile;
    if (!p) {
      setError(t("admin.billingProfileSaveFail"));
      return;
    }
    applyProfile(p);
    onSaved?.(p);
    setSaved(true);
  }

  if (loading) {
    return (
      <section>
        <h2 className={sectionLabel}>{t("admin.billingProfileTitle")}</h2>
        <div className={card}>
          <div className={cardBodyCompact}>
            <p className="text-[0.875rem] text-[var(--apple-label-secondary)]">
              {t("common.loading")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className={sectionLabel}>{t("admin.billingProfileTitle")}</h2>
      <div className={card}>
        <div className={cardBodyCompact}>
          <p className={`${hint} mb-2 text-[0.8125rem] leading-snug`}>
            {t("admin.billingProfileLead")}
          </p>
          {!complete && canEdit && (
            <p className="mb-2 text-[0.8125rem] font-medium leading-snug text-[var(--apple-orange)]">
              {t("admin.billingProfileIncomplete")}
            </p>
          )}
          {error && <p className={`${errorText} mb-2 text-[0.8125rem]`}>{error}</p>}
          {saved && <p className={`${successText} mb-2 text-[0.8125rem]`}>{t("admin.billingProfileSaved")}</p>}

          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label className={fieldLabel} htmlFor="billing-legal-name">
                  {t("admin.billingProfileLegalName")}
                </label>
                <input
                  id="billing-legal-name"
                  className={fieldInput}
                  value={form.legalName}
                  onChange={(e) => setField("legalName", e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="sm:col-span-6">
                <label className={fieldLabel} htmlFor="billing-address">
                  {t("admin.billingProfileAddress")}
                </label>
                <input
                  id="billing-address"
                  className={fieldInput}
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} htmlFor="billing-city">
                  {t("admin.billingProfileCity")}
                </label>
                <input
                  id="billing-city"
                  className={fieldInput}
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} htmlFor="billing-state">
                  {t("admin.billingProfileState")}
                </label>
                <input
                  id="billing-state"
                  className={fieldInput}
                  value={form.state}
                  onChange={(e) => setField("state", e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} htmlFor="billing-postal">
                  {t("admin.billingProfilePostal")}
                </label>
                <input
                  id="billing-postal"
                  className={fieldInput}
                  value={form.postalCode}
                  onChange={(e) => setField("postalCode", e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} htmlFor="billing-country">
                  {t("admin.billingProfileCountry")}
                </label>
                <input
                  id="billing-country"
                  className={fieldInput}
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} htmlFor="billing-gstin">
                  {t("admin.billingProfileGstin")}
                </label>
                <input
                  id="billing-gstin"
                  className={fieldInput}
                  value={form.gstin}
                  onChange={(e) => setField("gstin", e.target.value)}
                  disabled={!canEdit}
                  placeholder={t("admin.billingProfileGstinHint")}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} htmlFor="billing-email">
                  {t("admin.billingProfileEmail")}
                </label>
                <input
                  id="billing-email"
                  type="email"
                  className={fieldInput}
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className={fieldLabel} htmlFor="billing-phone">
                  {t("admin.billingProfilePhone")}
                </label>
                <input
                  id="billing-phone"
                  className={fieldInput}
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            </div>

            {canEdit && (
              <button
                type="submit"
                className={`${btnPrimary} mt-1 min-h-[2.25rem] px-4 py-2 text-[0.875rem]`}
                disabled={saving}
              >
                {saving ? t("common.processing") : t("admin.billingProfileSave")}
              </button>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
