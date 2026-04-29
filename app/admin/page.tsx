import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">관리자 대시보드</h1>
      <p className="mt-2 text-sm text-slate-600">
        출퇴근 기록, 예외 승인, 근무지 반경 설정은 메뉴에서 이동합니다.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/admin/attendance"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sky-300"
        >
          <p className="font-medium text-slate-900">출퇴근 기록</p>
          <p className="text-sm text-slate-500">테이블 + 지도 링크</p>
        </Link>
        <Link
          href="/admin/exceptions"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sky-300"
        >
          <p className="font-medium text-slate-900">반경 외 예외</p>
          <p className="text-sm text-slate-500">승인 / 반려</p>
        </Link>
        <Link
          href="/admin/sites"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-sky-300"
        >
          <p className="font-medium text-slate-900">근무지 등록</p>
          <p className="text-sm text-slate-500">좌표·반경·지각 기준</p>
        </Link>
      </ul>
    </div>
  );
}
