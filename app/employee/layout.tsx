import { requireConsent } from "@/lib/requireConsent";
import { SignOutButton } from "@/components/SignOutButton";
import Link from "next/link";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Link href="/employee" className="font-semibold text-sky-700">
          HereNow 직원
        </Link>
        <SignOutButton />
      </header>
      <div className="mx-auto max-w-lg px-3 py-4">{children}</div>
    </div>
  );
}
