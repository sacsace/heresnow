import { EmployeeHeader } from "@/components/EmployeeHeader";
import { requireConsent } from "@/lib/requireConsent";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <div className="min-h-dvh min-w-0 overflow-x-hidden bg-zinc-50 pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      <EmployeeHeader />
      <div className="mx-auto box-border w-full min-w-0 max-w-lg px-3 py-4 sm:px-4 md:max-w-3xl md:py-5 lg:max-w-5xl lg:px-8 lg:py-6">
        {children}
      </div>
    </div>
  );
}
