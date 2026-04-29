import { requireConsent } from "@/lib/requireConsent";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  const links = [
    { href: "/admin", label: "대시보드" },
    { href: "/admin/attendance", label: "출퇴근" },
    { href: "/admin/exceptions", label: "예외 승인" },
    { href: "/admin/sites", label: "근무지" },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <span className="font-semibold text-sky-800">HereNow 관리</span>
          <nav className="flex flex-wrap gap-2 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-2 py-1 text-slate-700 hover:bg-slate-100"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/employee" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">
              직원 화면
            </Link>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}
