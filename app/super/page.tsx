"use client";

import { useI18n } from "@/components/LanguageProvider";
import { isSubscriptionDateOnly, subscriptionEndsAtToDateInput } from "@/lib/subscriptionEndsAt";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Company = {
  id: string;
  name: string;
  createdAt: string;
  seatLimit: number;
  timezone: string;
  subscriptionEndsAt: string | null;
  pricingTier: { label: string | null; maxSeats: number; pricePerYear: number } | null;
  _count: { users: number; employees: number; attendanceRecords: number };
};

type RowDraft = { seatLimit: string; subscriptionInput: string };

export default function SuperPage() {
  const { t, locale } = useI18n();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Record<string, RowDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [logs, setLogs] = useState<
    { id: string; action: string; timestamp: string; company: { name: string }; approver: { email: string } }[]
  >([]);

  const load = useCallback(async () => {
    setBanner(null);
    const r = await fetch("/api/super/companies");
    const text = await r.text();
    let j: { companies?: Company[] } = {};
    if (text.trim()) {
      try {
        j = JSON.parse(text) as { companies?: Company[] };
      } catch {
        return;
      }
    }
    if (r.ok) setCompanies(j.companies ?? []);

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
  }, []);

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

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{t("super.companiesTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">{t("super.platformLead")}</p>
        {banner && <p className="mt-2 text-sm text-sky-700">{banner}</p>}
        <form onSubmit={create} className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
            placeholder={t("super.newCompanyPlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            {t("super.create")}
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">{t("super.shellCreateHint")}</p>

        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">{t("super.thName")}</th>
                <th className="px-3 py-2">{t("super.thSeatCap")}</th>
                <th className="px-3 py-2">{t("super.thSeatUsage")}</th>
                <th className="px-3 py-2">{t("super.thSubscriptionEnd")}</th>
                <th className="px-3 py-2">{t("super.thUsers")}</th>
                <th className="px-3 py-2">{t("super.thEmployees")}</th>
                <th className="px-3 py-2">{t("super.thAttendance")}</th>
                <th className="px-3 py-2">{t("super.thActions")}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 text-zinc-800">
                    <Link
                      href={`/super/companies/${c.id}`}
                      className="font-medium text-sky-600 hover:text-sky-800 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-1 text-zinc-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
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
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {c._count.employees} / {c.seatLimit}
                    {c.pricingTier && (
                      <span className="block text-zinc-400">
                        Rs.{c.pricingTier.pricePerYear}
                        {t("super.perYear")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      className="min-w-[9.5rem] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-800 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
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
                  <td className="px-3 py-2 text-zinc-700">{c._count.users}</td>
                  <td className="px-3 py-2 text-zinc-700">{c._count.employees}</td>
                  <td className="px-3 py-2 text-zinc-700">{c._count.attendanceRecords}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={savingId === c.id}
                      className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-900 disabled:opacity-50"
                      onClick={() => void saveCompany(c.id)}
                    >
                      {savingId === c.id ? "…" : t("super.saveCompany")}
                    </button>
                    <a
                      className="ml-2 text-sm text-sky-600 hover:text-sky-700 hover:underline"
                      href={`/api/admin/export?companyId=${encodeURIComponent(c.id)}`}
                    >
                      {t("super.excel")}
                    </a>
                    <button
                      type="button"
                      className="ml-2 text-xs text-red-500 hover:underline"
                      onClick={() => void remove(c.id)}
                    >
                      {t("super.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold tracking-tight text-zinc-900">{t("super.auditTitle")}</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600">
          {logs.map((l) => (
            <li key={l.id} className="rounded-lg border border-zinc-200/80 bg-white px-3 py-2">
              <span className="text-zinc-400">
                {new Date(l.timestamp).toLocaleString(locale === "en" ? "en-IN" : "ko-KR")}
              </span>{" "}
              · {l.company.name} · {l.approver.email} ·{" "}
              <span className="font-medium text-sky-600">{l.action}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
