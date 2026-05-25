"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import {
  btnPrimary,
  card,
  cardBody,
  errorText,
  groupedCard,
  groupedRow,
  hint,
  input,
  label,
  link,
  pageStack,
  sectionLabel,
} from "@/lib/uiStyles";
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
    <div className={pageStack}>
      <PageHeader
        title="직원"
        subtitle={
          seatInfo
            ? `좌석 ${seatInfo.used} / ${seatInfo.limit}명 · 상한 초과 시 요금·상향이 필요합니다.`
            : undefined
        }
        actions={
          seatInfo ? (
            <a href="/admin/billing" className={link}>
              요금·상향 →
            </a>
          ) : undefined
        }
      />

      <section>
        <p className={sectionLabel}>직원 추가</p>
        <div className={card}>
          <div className={cardBody}>
            <form onSubmit={(e) => void addEmployee(e)} className="grid max-w-lg gap-4">
              <div>
                <label className={label}>이메일</label>
                <input
                  required
                  type="email"
                  className={`${input} mt-1.5`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>이름</label>
                <input
                  required
                  className={`${input} mt-1.5`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>임시 비밀번호</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  className={`${input} mt-1.5`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className={`mt-1.5 ${hint}`}>8자 이상</p>
              </div>
              {error && <p className={errorText}>{error}</p>}
              <button type="submit" className={`${btnPrimary} w-full sm:w-auto`}>
                추가
              </button>
            </form>
          </div>
        </div>
      </section>

      <section>
        <p className={sectionLabel}>목록</p>
        <ul className={groupedCard}>
          {employees.map((e, i) => (
            <li
              key={e.id}
              className={`${groupedRow} ${i < employees.length - 1 ? "border-b border-[var(--separator)]" : ""}`}
            >
              <p className="font-semibold text-[var(--foreground)]">{e.name}</p>
              <p className="mt-0.5 text-[0.875rem] text-[var(--apple-label-secondary)]">
                {e.user.email} · {e.user.role}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
