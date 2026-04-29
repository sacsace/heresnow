"use client";

import { useCallback, useEffect, useState } from "react";

type Company = {
  id: string;
  name: string;
  createdAt: string;
  _count: { users: number; employees: number; attendanceRecords: number };
};

export default function SuperPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [name, setName] = useState("");
  const [logs, setLogs] = useState<
    { id: string; action: string; timestamp: string; company: { name: string }; approver: { email: string } }[]
  >([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/super/companies");
    const j = await r.json();
    if (r.ok) setCompanies(j.companies ?? []);
    const lr = await fetch("/api/super/audit");
    const lj = await lr.json();
    if (lr.ok) setLogs(lj.logs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function remove(id: string) {
    if (!confirm("회사와 연결 데이터를 삭제합니다. 계속할까요?")) return;
    await fetch(`/api/super/companies/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-xl font-semibold">회사 (테넌트)</h1>
        <form onSubmit={create} className="mt-3 flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            placeholder="새 회사 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 hover:bg-sky-400">
            생성
          </button>
        </form>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">사용자</th>
                <th className="px-3 py-2">직원</th>
                <th className="px-3 py-2">출퇴근 건수</th>
                <th className="px-3 py-2">액션</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c._count.users}</td>
                  <td className="px-3 py-2">{c._count.employees}</td>
                  <td className="px-3 py-2">{c._count.attendanceRecords}</td>
                  <td className="px-3 py-2">
                    <a
                      className="text-sky-400 underline"
                      href={`/api/admin/export?companyId=${encodeURIComponent(c.id)}`}
                    >
                      Excel
                    </a>
                    <button
                      type="button"
                      className="ml-3 text-xs text-red-400 hover:underline"
                      onClick={() => void remove(c.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">전체 승인 로그</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {logs.map((l) => (
            <li key={l.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <span className="text-slate-400">{new Date(l.timestamp).toLocaleString("ko-KR")}</span> · {l.company.name}{" "}
              · {l.approver.email} · <span className="text-sky-300">{l.action}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
