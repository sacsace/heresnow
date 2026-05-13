"use client";

import { useI18n } from "@/components/LanguageProvider";
import Link from "next/link";

export default function AdminHomePage() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{t("admin.homeTitle")}</h1>
      <p className="mt-2 text-sm text-zinc-500">{t("admin.homeLead")}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/attendance"
          className="rounded-xl border border-zinc-200/80 bg-white p-4 hover:border-sky-200"
        >
          <p className="font-medium text-zinc-900">{t("admin.cardAttendanceTitle")}</p>
          <p className="text-sm text-zinc-500">{t("admin.cardAttendanceDesc")}</p>
        </Link>
        <Link
          href="/admin/exceptions"
          className="rounded-xl border border-zinc-200/80 bg-white p-4 hover:border-sky-200"
        >
          <p className="font-medium text-zinc-900">{t("admin.cardExceptionsTitle")}</p>
          <p className="text-sm text-zinc-500">{t("admin.cardExceptionsDesc")}</p>
        </Link>
      </ul>
    </div>
  );
}
