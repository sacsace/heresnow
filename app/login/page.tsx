"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
      callbackUrl,
    });
    setLoading(false);
    if (res?.error) {
      setError("이메일 또는 비밀번호를 확인해 주세요.");
      return;
    }
    window.location.href = callbackUrl;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold text-slate-900">HereNow</h1>
        <p className="mt-2 text-center text-sm text-slate-600">
          현장·출장 출퇴근 증빙 (클릭 시점 GPS만 저장)
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">이메일</label>
            <input
              type="email"
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">비밀번호</label>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-sky-500 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-600 py-3 font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          관리자: lee@msventures.in / admin123 · 직원 데모: employee@acme.local / demo1234
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-600">로딩…</div>}>
      <LoginForm />
    </Suspense>
  );
}
