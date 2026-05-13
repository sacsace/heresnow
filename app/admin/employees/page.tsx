"use client";

import { useCallback, useEffect, useState } from "react";

type Emp = {
  id: string;
  name: string;
  user: { email: string; role: string };
};

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [seatInfo, setSeatInfo] = useState<{ used: number; limit: number } | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [er, br] = await Promise.all([fetch("/api/admin/employees"), fetch("/api/admin/billing")]);
    const ej = await er.json();
    const bj = await br.json();
    if (er.ok) setEmployees(ej.employees ?? []);
    if (br.ok) {
      setSeatInfo({ used: bj.employeeCount ?? 0, limit: bj.company?.seatLimit ?? 0 });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error ?? "추가 실패");
      return;
    }
    setEmail("");
    setName("");
    setPassword("");
    await load();
  }

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">직원</h1>
      {seatInfo && (
        <p className="text-sm text-zinc-600">
          좌석: <strong>{seatInfo.used}</strong> / {seatInfo.limit}명 — 상한 초과 시{" "}
          <a href="/admin/billing" className="text-sky-600 underline">
            요금·상향
          </a>
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-medium text-zinc-800">직원 추가</h2>
        <form onSubmit={(e) => void addEmployee(e)} className="mt-4 grid max-w-md gap-3">
          <input
            required
            type="email"
            placeholder="이메일"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            required
            placeholder="이름"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            required
            type="password"
            minLength={8}
            placeholder="임시 비밀번호 (8자 이상)"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="rounded-lg bg-sky-600 py-2 text-sm font-medium text-white hover:bg-sky-700">
            추가
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="font-medium text-zinc-800">목록</h2>
        <ul className="mt-3 divide-y divide-zinc-100 text-sm">
          {employees.map((emp) => (
            <li key={emp.id} className="flex justify-between py-2">
              <span>{emp.name}</span>
              <span className="text-zinc-500">
                {emp.user.email} · {emp.user.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
