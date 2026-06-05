"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { AppleConfirmDialog } from "@/components/ui/AppleConfirmDialog";
import { useI18n } from "@/components/LanguageProvider";
import { isSubscriptionDateOnly, subscriptionEndsAtToDateInput } from "@/lib/subscriptionEndsAt";
import {
  bannerInfo,
  bodySection,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnSecondary,
  caption,
  cardActionBar,
  cardBody,
  emptyStateCompact,
  errorText,
  filterCheckboxLabel,
  formFieldName,
  formInlineRow,
  groupedCard,
  hintBox,
  input,
  inputCompact,
  inputNumberCell,
  label,
  link,
  pageStackDetail,
  searchFieldWrap,
  searchToolbar,
  sectionLabel,
  table,
  tableHead,
  tableRow,
  tableToolbar,
  tableWrap,
  td,
  th,
} from "@/lib/uiStyles";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Company = {
  id: string;
  name: string;
  createdAt: string;
  seatLimit: number;
  timezone: string;
  subscriptionEndsAt: string | null;
  billingDiscountPercent: number;
  billingDiscountAmount: number;
  pricingTier: {
    label: string | null;
    maxSeats: number;
    priceAmount: number;
    pricePerUser: number;
    billingPeriod: "MONTHLY" | "YEARLY";
  } | null;
  _count: { users: number; employees: number; attendanceRecords: number };
};

type RowDraft = {
  name: string;
  seatLimit: string;
  subscriptionInput: string;
  discountPercent: string;
  discountAmount: string;
};

function draftFromCompany(c: Company, prev?: Partial<RowDraft>): RowDraft {
  return {
    name: prev?.name ?? c.name,
    seatLimit: prev?.seatLimit ?? String(c.seatLimit),
    subscriptionInput:
      prev?.subscriptionInput ??
      subscriptionEndsAtToDateInput(c.subscriptionEndsAt, c.timezone),
    discountPercent: prev?.discountPercent ?? String(c.billingDiscountPercent ?? 0),
    discountAmount: prev?.discountAmount ?? String(c.billingDiscountAmount ?? 0),
  };
}

function companyInUse(c: Company) {
  return c._count.users > 0 || c._count.employees > 0 || c._count.attendanceRecords > 0;
}

function clampDiscountPercent(raw: string): string {
  if (raw.trim() === "") return "";
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return "0";
  return String(Math.min(100, Math.max(0, n)));
}

export default function SuperPage() {
  const { t, locale } = useI18n();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [draft, setDraft] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [savingNameId, setSavingNameId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [discountWarning, setDiscountWarning] = useState<{
    companyId: string;
    previousPercent: string;
    nextPercent: string;
  } | null>(null);
  const [logs, setLogs] = useState<
    { id: string; action: string; timestamp: string; company: { name: string }; approver: { email: string } }[]
  >([]);

  const load = useCallback(async () => {
    setBanner(null);
    setLoadError(null);
    const r = await fetch("/api/super/companies");
    const text = await r.text();
    let j: { companies?: Company[]; error?: string } = {};
    if (text.trim()) {
      try {
        j = JSON.parse(text) as { companies?: Company[]; error?: string };
      } catch {
        setLoadError(t("super.loadCompaniesFail"));
        return;
      }
    }
    if (!r.ok) {
      setLoadError(typeof j.error === "string" ? j.error : t("super.loadCompaniesFail"));
      setCompanies([]);
      return;
    }
    setCompanies(j.companies ?? []);

    const lr = await fetch("/api/super/audit");
    const lt = await lr.text();
    let lj: { logs?: typeof logs } = {};
    if (lt.trim()) {
      try {
        lj = JSON.parse(lt) as { logs?: typeof logs };
      } catch {
        /* ignore */
      }
    }
    if (lr.ok) setLogs(lj.logs ?? []);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const m: Record<string, RowDraft> = {};
    for (const c of companies) {
      m[c.id] = draftFromCompany(c);
    }
    setDraft(m);
  }, [companies]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/super/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    await load();
  }

  function updateDraftDiscountPercent(companyId: string, c: Company, raw: string) {
    const prev = draft[companyId]?.discountPercent ?? "0";
    const next = clampDiscountPercent(raw);
    if (next === prev) return;

    setDraft((prevDraft) => ({
      ...prevDraft,
      [companyId]: draftFromCompany(c, {
        ...prevDraft[companyId],
        discountPercent: next,
      }),
    }));

    if (next !== "" && Number.parseInt(next, 10) > 50) {
      setDiscountWarning({
        companyId,
        previousPercent: prev,
        nextPercent: next,
      });
    }
  }

  function confirmHighDiscount() {
    setDiscountWarning(null);
  }

  function cancelHighDiscount() {
    if (!discountWarning) return;
    const { companyId, previousPercent } = discountWarning;
    setDraft((prev) => ({
      ...prev,
      [companyId]: {
        ...prev[companyId],
        discountPercent: previousPercent,
      },
    }));
    setDiscountWarning(null);
  }

  async function saveCompany(id: string) {
    const d = draft[id];
    if (!d) return;
    const seatLimit = Number.parseInt(d.seatLimit, 10);
    if (!Number.isFinite(seatLimit) || seatLimit < 1) {
      setBanner(t("super.saveCompanyFail"));
      return;
    }
    let subscriptionEndsAt: string | null;
    const subRaw = d.subscriptionInput.trim();
    if (!subRaw) {
      subscriptionEndsAt = null;
    } else if (!isSubscriptionDateOnly(subRaw)) {
      setBanner(t("super.saveCompanyFail"));
      return;
    } else {
      subscriptionEndsAt = subRaw;
    }
    const discountPercent = Number.parseInt(d.discountPercent, 10);
    const discountAmount = Number.parseInt(d.discountAmount, 10);
    if (
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100 ||
      !Number.isFinite(discountAmount) ||
      discountAmount < 0
    ) {
      setBanner(t("super.saveCompanyFail"));
      return;
    }
    setSavingId(id);
    setBanner(null);
    const r = await fetch(`/api/super/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seatLimit,
        subscriptionEndsAt,
        billingDiscountPercent: discountPercent,
        billingDiscountAmount: discountAmount,
      }),
    });
    const body = await r.json().catch(() => ({}));
    setSavingId(null);
    if (!r.ok) {
      setBanner(typeof body.error === "string" ? body.error : t("super.saveCompanyFail"));
      return;
    }
    setBanner(t("super.saveCompanyOk"));
    await load();
  }

  function startEditName(c: Company) {
    setDraft((prev) => ({
      ...prev,
      [c.id]: draftFromCompany(c, prev[c.id]),
    }));
    setEditingNameId(c.id);
    setBanner(null);
  }

  function cancelEditName(c: Company) {
    setDraft((prev) => ({
      ...prev,
      [c.id]: draftFromCompany(c, {
        seatLimit: prev[c.id]?.seatLimit,
        subscriptionInput: prev[c.id]?.subscriptionInput,
        discountPercent: prev[c.id]?.discountPercent,
        discountAmount: prev[c.id]?.discountAmount,
      }),
    }));
    setEditingNameId(null);
  }

  async function saveCompanyName(c: Company) {
    const next = (draft[c.id]?.name ?? "").trim();
    if (!next) {
      setBanner(t("super.saveCompanyFail"));
      return;
    }
    if (next === c.name) {
      setEditingNameId(null);
      return;
    }
    setSavingNameId(c.id);
    setBanner(null);
    const r = await fetch(`/api/super/companies/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    const body = await r.json().catch(() => ({}));
    setSavingNameId(null);
    if (!r.ok) {
      setBanner(typeof body.error === "string" ? body.error : t("super.saveCompanyFail"));
      return;
    }
    setEditingNameId(null);
    setCompanies((prev) =>
      prev.map((row) => (row.id === c.id ? { ...row, name: next } : row))
    );
    setBanner(t("super.saveCompanyOk"));
  }

  async function remove(id: string) {
    if (!confirm(t("super.confirmDelete"))) return;
    await fetch(`/api/super/companies/${id}`, { method: "DELETE" });
    await load();
  }

  const filteredCompanies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return companies.filter((c) => {
      if (activeOnly && !companyInUse(c)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q);
    });
  }, [companies, searchQuery, activeOnly]);

  return (
    <div className={pageStackDetail}>
      <PageHeader title={t("super.companiesTitle")} subtitle={t("super.platformLead")} />

      {loadError && <p className={errorText}>{loadError}</p>}
      {banner && <p className={bannerInfo}>{banner}</p>}

      <section className={bodySection}>
        <p className={sectionLabel}>{t("super.create")}</p>
        <div className={groupedCard}>
          <div className={`${cardBody} !py-4`}>
            <form onSubmit={create} className={formInlineRow}>
              <div className={formFieldName}>
                <label className={label} htmlFor="new-company-name">
                  {t("super.newCompanyPlaceholder")}
                </label>
                <input
                  id="new-company-name"
                  className={`${input} mt-1.5`}
                  placeholder={t("super.newCompanyPlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className={`${btnPrimary} h-9 shrink-0 px-5`}>
                {t("super.create")}
              </button>
            </form>
            <p className={`mt-2 ${hintBox}`}>{t("super.shellCreateHint")}</p>
          </div>
        </div>
      </section>

      <section className={bodySection}>
        <p className={sectionLabel}>{t("super.thName")}</p>
        {companies.length === 0 ? (
          <div className={groupedCard}>
            <p className={emptyStateCompact}>—</p>
          </div>
        ) : (
          <div className={tableWrap}>
            <div className={tableToolbar}>
              <div className={searchToolbar}>
                <div className={searchFieldWrap}>
                  <label className={label} htmlFor="company-search">
                    {t("super.searchCompanies")}
                  </label>
                  <input
                    id="company-search"
                    type="search"
                    className={`${input} mt-1.5`}
                    placeholder={t("super.searchCompaniesPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <label className={filterCheckboxLabel}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[var(--separator)] accent-[var(--apple-blue)]"
                    checked={activeOnly}
                    onChange={(e) => setActiveOnly(e.target.checked)}
                  />
                  {t("super.filterActiveOnly")}
                </label>
              </div>
            </div>
            <table className={table}>
              <thead className={tableHead}>
                <tr>
                  <th className={th}>{t("super.thName")}</th>
                  <th className={`${th} w-[7rem] min-w-[7rem]`}>{t("super.thSeatCap")}</th>
                  <th className={`${th} w-[10.5rem]`}>{t("super.thSubscriptionEnd")}</th>
                  <th className={`${th} w-[15rem] min-w-[15rem] whitespace-nowrap`}>{t("super.thDiscount")}</th>
                  <th className={`${th} text-right`}>{t("super.thActions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr className={tableRow}>
                    <td className={`${td} py-6 text-center text-[var(--apple-label-tertiary)]`} colSpan={5}>
                      {t("super.searchNoResults")}
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((c) => (
                    <tr key={c.id} className={tableRow}>
                      <td className={td}>
                        <div className="flex min-w-[12rem] max-w-md items-center gap-2">
                          {editingNameId === c.id ? (
                            <>
                              <input
                                id={`name-${c.id}`}
                                type="text"
                                aria-label={t("super.thName")}
                                autoFocus
                                disabled={savingNameId === c.id}
                                className={`${inputCompact} flex-1 min-w-0 font-semibold`}
                                value={draft[c.id]?.name ?? c.name}
                                onChange={(e) =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    [c.id]: draftFromCompany(c, {
                                      ...prev[c.id],
                                      name: e.target.value,
                                    }),
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    void saveCompanyName(c);
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelEditName(c);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                disabled={savingNameId === c.id}
                                className={`${btnGhost} shrink-0 px-2`}
                                onClick={() => void saveCompanyName(c)}
                                aria-label={t("super.saveCompany")}
                                title={t("super.saveCompany")}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                disabled={savingNameId === c.id}
                                className={`${btnGhost} shrink-0 px-2 text-[var(--apple-label-secondary)]`}
                                onClick={() => cancelEditName(c)}
                                aria-label={t("common.cancel")}
                                title={t("common.cancel")}
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <>
                              <Link
                                href={`/super/companies/${c.id}`}
                                className={`${link} truncate text-[0.875rem] font-semibold sm:text-[0.9375rem]`}
                                title={c.name}
                              >
                                {c.name}
                              </Link>
                              <button
                                type="button"
                                className={`${btnGhost} shrink-0 px-2 text-[var(--apple-label-secondary)]`}
                                onClick={() => startEditName(c)}
                                aria-label={t("super.editNameAria")}
                                title={t("super.editNameAria")}
                              >
                                ✏️
                              </button>
                              <span
                                className={`${caption} hidden shrink-0 whitespace-nowrap lg:inline`}
                              >
                                {c._count.users}/{c._count.employees}/{c._count.attendanceRecords}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className={`${td} w-[7rem] min-w-[7rem]`}>
                        <input
                          id={`seat-${c.id}`}
                          type="number"
                          min={1}
                          aria-label={t("super.thSeatCap")}
                          className={inputNumberCell}
                          value={draft[c.id]?.seatLimit ?? String(c.seatLimit)}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [c.id]: draftFromCompany(c, {
                                ...prev[c.id],
                                seatLimit: e.target.value,
                              }),
                            }))
                          }
                        />
                      </td>
                      <td className={td}>
                        <input
                          id={`sub-${c.id}`}
                          type="date"
                          lang={locale === "en" ? "en-US" : "ko-KR"}
                          aria-label={t("super.thSubscriptionEnd")}
                          className={`${inputCompact} w-[9.5rem]`}
                          value={
                            draft[c.id]?.subscriptionInput ??
                            subscriptionEndsAtToDateInput(c.subscriptionEndsAt, c.timezone)
                          }
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [c.id]: draftFromCompany(c, {
                                ...prev[c.id],
                                subscriptionInput: e.target.value,
                              }),
                            }))
                          }
                        />
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        <div
                          className="inline-flex max-w-full flex-nowrap items-center overflow-hidden rounded-[0.625rem] border border-[var(--separator)] bg-[var(--grouped-bg)] shadow-sm"
                          role="group"
                          aria-label={t("super.thDiscount")}
                        >
                          <label
                            htmlFor={`disc-pct-${c.id}`}
                            className="flex shrink-0 items-center gap-1.5 border-r border-[var(--separator)] px-2.5 py-1.5"
                          >
                            <input
                              id={`disc-pct-${c.id}`}
                              type="number"
                              min={0}
                              max={100}
                              aria-label={`${t("super.thDiscount")} %`}
                              className="h-8 w-11 shrink-0 rounded-[0.5rem] border-0 bg-[var(--fill-secondary)] px-1.5 text-center text-[0.9375rem] font-semibold tabular-nums text-[var(--foreground)] outline-none [appearance:textfield] focus:bg-[var(--fill-secondary-hover)] focus:ring-2 focus:ring-[var(--apple-blue)]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              value={draft[c.id]?.discountPercent ?? "0"}
                              onChange={(e) => updateDraftDiscountPercent(c.id, c, e.target.value)}
                              onBlur={(e) => {
                                const clamped = clampDiscountPercent(e.target.value);
                                if (clamped === "") {
                                  setDraft((prev) => ({
                                    ...prev,
                                    [c.id]: draftFromCompany(c, {
                                      ...prev[c.id],
                                      discountPercent: "0",
                                    }),
                                  }));
                                } else if (clamped !== e.target.value) {
                                  updateDraftDiscountPercent(c.id, c, clamped);
                                }
                              }}
                            />
                            <span className="shrink-0 text-[0.8125rem] font-bold text-[var(--apple-blue)]">
                              %
                            </span>
                          </label>
                          <label
                            htmlFor={`disc-amt-${c.id}`}
                            className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5"
                          >
                            <span className="shrink-0 text-[0.8125rem] font-bold text-[var(--apple-green-dark)]">
                              Rs.
                            </span>
                            <input
                              id={`disc-amt-${c.id}`}
                              type="number"
                              min={0}
                              aria-label={`${t("super.thDiscount")} Rs`}
                              className="h-8 w-[4.5rem] shrink-0 rounded-[0.5rem] border-0 bg-[var(--fill-secondary)] px-2 text-right text-[0.9375rem] font-semibold tabular-nums text-[var(--foreground)] outline-none [appearance:textfield] focus:bg-[var(--fill-secondary-hover)] focus:ring-2 focus:ring-[var(--apple-green)]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              value={draft[c.id]?.discountAmount ?? "0"}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [c.id]: draftFromCompany(c, {
                                    ...prev[c.id],
                                    discountAmount: e.target.value,
                                  }),
                                }))
                              }
                            />
                          </label>
                        </div>
                      </td>
                      <td className={td}>
                        <div className={`${cardActionBar} justify-end`}>
                          <button
                            type="button"
                            disabled={savingId === c.id}
                            className={btnSecondary}
                            onClick={() => void saveCompany(c.id)}
                          >
                            {savingId === c.id ? "…" : t("super.saveCompany")}
                          </button>
                          <a
                            className={btnGhost}
                            href={`/api/admin/export?companyId=${encodeURIComponent(c.id)}`}
                          >
                            {t("super.excel")}
                          </a>
                          <button type="button" className={btnDanger} onClick={() => void remove(c.id)}>
                            {t("super.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={bodySection}>
        <p className={sectionLabel}>{t("super.auditTitle")}</p>
        <div className={tableWrap}>
          <table className={table}>
            <thead className={tableHead}>
              <tr>
                <th className={th}>{t("super.auditColTime")}</th>
                <th className={th}>{t("super.auditColCompany")}</th>
                <th className={th}>{t("super.auditColApprover")}</th>
                <th className={th}>{t("super.auditColAction")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr className={tableRow}>
                  <td className={`${td} py-6 text-center text-[var(--apple-label-tertiary)]`} colSpan={4}>
                    {t("common.noData")}
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className={tableRow}>
                    <td className={`${td} whitespace-nowrap text-[var(--apple-label-secondary)]`}>
                      {new Date(l.timestamp).toLocaleString(locale === "en" ? "en-IN" : "ko-KR")}
                    </td>
                    <td className={td}>{l.company.name}</td>
                    <td className={`${td} text-[var(--apple-label-secondary)]`}>{l.approver.email}</td>
                    <td className={`${td} font-semibold text-[var(--apple-blue)]`}>{l.action}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AppleConfirmDialog
        open={discountWarning !== null}
        title={t("super.discountHighWarningTitle")}
        message={t("super.discountHighWarningMessage").replace(
          "{n}",
          discountWarning?.nextPercent ?? ""
        )}
        confirmLabel={t("super.discountHighWarningConfirm")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmHighDiscount}
        onCancel={cancelHighDiscount}
      />
    </div>
  );
}
