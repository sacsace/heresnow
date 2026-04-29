import { requireConsent } from "@/lib/requireConsent";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/super" className="font-semibold text-sky-300">
            HereNow SUPER_ADMIN
          </Link>
          <SignOutButton className="border-slate-600 text-slate-100 hover:bg-slate-800" />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}
