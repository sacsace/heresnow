"use client";

import { PageHeader } from "@/components/ui/PageHeader";
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
  pricingTier: {
    label: string | null;
    maxSeats: number;
    priceAmount: number;
    billingPeriod: "MONTHLY" | "YEARLY";
  } | null;
  _count: { users: number; employees: number; attendanceRecords: number };
};

type RowDraft = { seatLimit: string; subscriptionInput: string };

function companyInUse(c: Company) {
  return c._count.users > 0 || c._count.employees > 0 || c._count.attendanceRecords > 0;
}

export default function SuperPage() {
  const { t, locale } = useI18n();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [draft, setDraft] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      m[c.id] = {
        seatLimit: String(c.seatLimit),
        subscriptionInput: subscriptionEndsAtToDateInput(c.subscriptionEndsAt, c.timezone),
      };
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
    setSavingId(id);
    setBanner(null);
    const r = await fetch(`/api/super/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatLimit, subscriptionEndsAt }),
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
                  <th className={`${th} text-right`}>{t("super.thActions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCompanies.length === 0 ? (
                  <tr className={tableRow}>
                    <td className={`${td} py-6 text-center text-[var(--apple-label-tertiary)]`} colSpan={4}>
                      {t("super.searchNoResults")}
                    </td>
                  </tr>
                ) : (
                  filteredCompanies.map((c) => (
                    <tr key={c.id} className={tableRow}>
                      <td className={td}>
                        <div className="flex min-w-[10rem] max-w-md items-center gap-2">
                          <Link
                            href={`/super/companies/${c.id}`}
                            className={`${link} truncate text-[0.875rem] font-semibold sm:text-[0.9375rem]`}
                            title={c.name}
                          >
                            {c.name}
                          </Link>
                          <span className={`${caption} hidden shrink-0 whitespace-nowrap lg:inline`}>
                            {c._count.users}/{c._count.employees}/{c._count.attendanceRecords}
                          </span>
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
                              [c.id]: {
                                seatLimit: e.target.value,
                                subscriptionInput:
                                  prev[c.id]?.subscriptionInput ??
                                  subscriptionEndsAtToDateInput(c.subscriptionEndsAt, c.timezone),
                              },
                            }))
                          }
                        />
                      </td>
                      <td className={td}>
                        <input
                          id={`sub-${c.id}`}
                          type="date"
                          aria-label={t("super.thSubscriptionEnd")}
                          className={`${inputCompact} w-[9.5rem]`}
                          value={
                            draft[c.id]?.subscriptionInput ??
                            subscriptionEndsAtToDateInput(c.subscriptionEndsAt, c.timezone)
                          }
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              [c.id]: {
                                seatLimit: prev[c.id]?.seatLimit ?? String(c.seatLimit),
                                subscriptionInput: e.target.value,
                              },
                            }))
                          }
                        />
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
    </div>
  );
}
