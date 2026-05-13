import { SuperNavBar } from "@/components/SuperNavBar";
import { requireConsent } from "@/lib/requireConsent";

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-800">
      <SuperNavBar />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
