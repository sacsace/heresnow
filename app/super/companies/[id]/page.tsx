"use client";

import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type RowUser = {
  id: string;
  email: string;
  role: string;
  consentGivenAt: string | null;
  createdAt: string;
  employee: { id: string; name: string } | null;
};

type CompanyDetail = {
  id: string;
  name: string;
  seatLimit: number;
  subscriptionEndsAt: string | null;
  _count: { users: number; employees: number; attendanceRecords: number };
};

const ADD_ROLES = ["COMPANY_ADMIN", "HR_MANAGER", "APPROVER", "EMPLOYEE"] as const;

export default function SuperCompanyUsersPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<RowUser[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ADD_ROLES)[number]>("EMPLOYEE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    setNotFound(false);
    const [cr, ur] = await Promise.all([
      fetch(`/api/super/companies/${id}`),
      fetch(`/api/super/companies/${id}/users`),
    ]);
    const cj = await cr.json().catch(() => ({}));
    const uj = await ur.json().catch(() => ({}));
    if (cr.ok) {
      setCompany(cj.company ?? null);
      setNotFound(!cj.company);
    } else {
      setCompany(null);
      setNotFound(cr.status === 404);
      setLoadError(typeof cj.error === "string" ? cj.error : null);
    }
    if (ur.ok) setUsers(uj.users ?? []);
    else setUsers([]);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function roleLabel(r: string) {
    switch (r) {
      case "COMPANY_ADMIN":
        return t("super.roleCompanyAdmin");
      case "HR_MANAGER":
        return t("super.roleHr");
      case "APPROVER":
        return t("super.roleApprover");
      case "EMPLOYEE":
        return t("super.roleEmployee");
      default:
        return r;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const r = await fetch(`/api/super/companies/${id}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password, role }),
    });
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      setError(typeof j.error === "string" ? j.error : t("super.addUserFail"));
      return;
    }
    setEmail("");
    setName("");
    setPassword("");
    setRole("EMPLOYEE");
    await load();
  }

  if (!id) return null;

  if (!company) {
    return (
      <div className="space-y-4">
        <Link href="/super" className="text-sm font-medium text-sky-600 hover:text-sky-800 hover:underline">
          ← {t("super.backToCompanies")}
        </Link>
        <p className="text-sm text-zinc-600">
          {notFound ? t("super.companyNotFound") : loadError ?? t("super.addUserFail")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/super" className="text-sm font-medium text-sky-600 hover:text-sky-800 hover:underline">
          ← {t("super.backToCompanies")}
        </Link>
        <h1 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900">
          {company.name} — {t("super.companyUsersTitle")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">{t("super.companyUsersSubtitle")}</p>
        <p className="mt-1 text-sm text-zinc-500">
          {t("super.usersSeatUsage")}: {company._count.employees} / {company.seatLimit}
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200/80 bg-white p-6">
        <h2 className="text-base font-semibold text-zinc-900">{t("super.addUserSection")}</h2>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 grid max-w-lg gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-600">{t("super.addEmail")}</label>
            <input
              type="email"
              required
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600">{t("super.addName")}</label>
            <input
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600">{t("super.addRole")}</label>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ADD_ROLES)[number])}
            >
              {ADD_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-zinc-600">{t("super.addPassword")}</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-100"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {loading ? t("common.processing") : t("super.addButton")}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold text-zinc-900">{t("super.userListTitle")}</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">{t("super.listEmail")}</th>
                <th className="px-3 py-2">{t("super.listName")}</th>
                <th className="px-3 py-2">{t("super.listRole")}</th>
                <th className="px-3 py-2">{t("super.listConsent")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-800">{u.email}</td>
                  <td className="px-3 py-2 text-zinc-700">{u.employee?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-zinc-700">{roleLabel(u.role)}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {u.consentGivenAt ? t("super.consentDone") : t("super.consentPending")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
