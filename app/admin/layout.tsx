import { AdminNavBar } from "@/components/AdminNavBar";
import { requireConsent } from "@/lib/requireConsent";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <div className="min-h-dvh min-w-0 overflow-x-hidden bg-zinc-50 pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <AdminNavBar />
      <div className="mx-auto box-border w-full min-w-0 max-w-[86.4rem] px-3 py-4 sm:px-4 sm:py-6 md:px-6">{children}</div>
    </div>
  );
}
