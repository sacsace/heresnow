"use client";

import type { Department } from "@/components/admin/DepartmentManagerModal";
import { useI18n } from "@/components/LanguageProvider";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import { canAssignRole, canDeleteEmployee } from "@/lib/roleHierarchy";
import { emptyStateCompact, tableHead, tableWrap, trDivider } from "@/lib/uiStyles";
import type { Role } from "@prisma/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type EmployeeRow = {
  id: string;
  name: string;
  user: { id: string; email: string; role: string };
  department: { id: string; name: string } | null;
  scheduleSummary?: string;
  workScheduleType?: string | null;
  shiftCode?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  loginEligible?: boolean;
  loginEligibleByAdmin?: boolean;
  seatRank?: number;
};

const rowControl =
  "h-7 w-full rounded-[0.4375rem] bg-[var(--fill-secondary)] px-2 pr-7 text-[0.75rem] leading-none text-[var(--foreground)] outline-none transition-[box-shadow,background-color] focus:ring-2 focus:ring-[var(--apple-blue)]/25 disabled:opacity-60";
const rowControlStatic =
  "flex h-7 w-full items-center rounded-[0.4375rem] bg-[var(--fill-tertiary)] px-2 text-[0.75rem] text-[var(--apple-label-secondary)]";
const rowInput =
  "h-7 w-full min-w-0 rounded-[0.4375rem] bg-[var(--fill-secondary)] px-2 text-[0.75rem] leading-none text-[var(--foreground)] outline-none transition-[box-shadow,background-color] focus:ring-2 focus:ring-[var(--apple-blue)]/25 disabled:opacity-60";
const rowPasswordMask =
  "flex h-7 w-full min-w-0 items-center rounded-[0.4375rem] bg-[var(--fill-secondary)] px-2 text-[0.75rem] tracking-[0.18em] text-[var(--apple-label-secondary)] outline-none transition-[box-shadow,background-color] hover:bg-[var(--fill-secondary-hover)] focus:ring-2 focus:ring-[var(--apple-blue)]/25 disabled:cursor-default disabled:opacity-60";

const empTable = "w-full min-w-full text-left text-[0.8125rem] sm:text-[0.875rem]";
const empTh = "px-3 py-2 whitespace-nowrap sm:px-3.5";
const empTd = "px-3 py-2 align-middle text-[var(--foreground)] sm:px-3.5";
const empBtnDanger =
  "inline-flex h-7 touch-manipulation items-center justify-center rounded-md bg-[var(--apple-red)]/10 px-2.5 text-[0.75rem] font-medium text-[var(--apple-red)] transition-colors hover:bg-[var(--apple-red)]/16 disabled:opacity-40";

const WIDTH_STORAGE_KEY = "heresnow_employee_col_widths_v4";

type ResizableCol = "name" | "email" | "password" | "role" | "department";
type SortKey = ResizableCol;
type SortDir = "asc" | "desc";

type ColWidths = Record<ResizableCol, number> & { actions: number };

const DEFAULT_WIDTHS: ColWidths = {
  name: 148,
  email: 220,
  password: 96,
  role: 132,
  department: 128,
  actions: 56,
};

const MIN_WIDTHS: ColWidths = {
  name: 96,
  email: 140,
  password: 80,
  role: 100,
  department: 96,
  actions: 48,
};

const LOGIN_COL_WIDTH = 120;
const SCHEDULE_COL_WIDTH = 148;
const SELECT_COL_WIDTH = 56;

const ROLE_ORDER: Role[] = ["EMPLOYEE", "DOOR", "APPROVER", "HR_MANAGER", "COMPANY_ADMIN"];

function loadStoredWidths(): ColWidths {
  if (typeof window === "undefined") return DEFAULT_WIDTHS;
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDTHS;
    const parsed = JSON.parse(raw) as Partial<ColWidths>;
    const next = { ...DEFAULT_WIDTHS };
    for (const key of Object.keys(DEFAULT_WIDTHS) as (keyof ColWidths)[]) {
      const v = parsed[key];
      if (typeof v === "number" && Number.isFinite(v)) {
        next[key] = Math.max(MIN_WIDTHS[key], v);
      }
    }
    return next;
  } catch {
    return DEFAULT_WIDTHS;
  }
}

function compareString(a: string, b: string, locale: string) {
  return a.localeCompare(b, locale);
}

function roleSortIndex(role: string) {
  const i = ROLE_ORDER.indexOf(role as Role);
  return i < 0 ? 99 : i;
}

type Props = {
  employees: EmployeeRow[];
  departments: Department[];
  canEditProfile: boolean;
  canEditRoles: boolean;
  callerRole: Role | null;
  callerUserId: string | null;
  assignableRoles: Role[];
  rowBusyId: string | null;
  passwordEditId: string | null;
  passwordDraft: string;
  onPasswordDraftChange: (value: string) => void;
  onPasswordEditStart: (empId: string) => void;
  onPasswordEditFinish: (empId: string) => void;
  onPasswordEditCancel: () => void;
  onSaveName: (emp: EmployeeRow, value: string) => void;
  onSaveEmail: (emp: EmployeeRow, value: string) => void;
  onChangeRole: (emp: EmployeeRow, role: Role) => void;
  onChangeDepartment: (empId: string, deptId: string) => void;
  onDelete: (emp: EmployeeRow) => void;
  deleteDisabledReason: (emp: EmployeeRow, isSelf: boolean) => string | undefined;
  roleLabel: (role: string) => string;
  canEditSchedule?: boolean;
  onEditSchedule?: (emp: EmployeeRow) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
};

export function EmployeeListTable({
  employees,
  departments,
  canEditProfile,
  canEditRoles,
  callerRole,
  callerUserId,
  assignableRoles,
  rowBusyId,
  passwordEditId,
  passwordDraft,
  onPasswordDraftChange,
  onPasswordEditStart,
  onPasswordEditFinish,
  onPasswordEditCancel,
  onSaveName,
  onSaveEmail,
  onChangeRole,
  onChangeDepartment,
  onDelete,
  deleteDisabledReason,
  roleLabel,
  canEditSchedule = false,
  onEditSchedule,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: Props) {
  const { t, locale } = useI18n();
  const dl = locale === "en" ? "en-US" : "ko-KR";
  const [widths, setWidths] = useState<ColWidths>(DEFAULT_WIDTHS);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const resizeRef = useRef<{ col: ResizableCol; startX: number; startW: number } | null>(null);

  useEffect(() => {
    setWidths(loadStoredWidths());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(widths));
    } catch {
      /* ignore */
    }
  }, [widths]);

  const sortedEmployees = useMemo(() => {
    const arr = [...employees];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = compareString(a.name, b.name, dl);
          break;
        case "email":
          cmp = compareString(a.user.email, b.user.email, dl);
          break;
        case "role":
          cmp = roleSortIndex(a.user.role) - roleSortIndex(b.user.role);
          break;
        case "department":
          cmp = compareString(a.department?.name ?? "", b.department?.name ?? "", dl);
          break;
        case "password":
          cmp = 0;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [employees, sortKey, sortDir, dl]);

  function toggleSort(key: SortKey) {
    if (key === "password") return;
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const startResize = useCallback((col: ResizableCol, clientX: number) => {
    resizeRef.current = { col, startX: clientX, startW: widths[col] };
  }, [widths]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const delta = e.clientX - r.startX;
      setWidths((prev) => ({
        ...prev,
        [r.col]: Math.max(MIN_WIDTHS[r.col], r.startW + delta),
      }));
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const sortArrow = (key: SortKey) => {
    if (key === "password") return null;
    if (sortKey !== key) {
      return (
        <span aria-hidden className="ml-1 text-[var(--apple-label-tertiary)] opacity-50">
          ↕
        </span>
      );
    }
    return (
      <span aria-hidden className="ml-1 text-[var(--apple-blue)]">
        {sortDir === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const headerCell = (key: SortKey, label: string, resizable: boolean) => (
    <th
      key={key}
      className={`${empTh} relative select-none text-left`}
      style={{ width: widths[key], minWidth: MIN_WIDTHS[key] }}
      aria-sort={
        key !== "password" && sortKey === key
          ? sortDir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      {key === "password" ? (
        <span className="block truncate pr-2">{label}</span>
      ) : (
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex max-w-full items-center truncate pr-3 text-inherit hover:text-[var(--foreground)]"
        >
          {label}
          {sortArrow(key)}
        </button>
      )}
      {resizable && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("admin.employeesResizeColumn")}
          className="absolute right-0 top-0 z-10 h-full w-2 translate-x-1/2 cursor-col-resize touch-none hover:bg-[var(--apple-blue)]/25 active:bg-[var(--apple-blue)]/40"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startResize(key, e.clientX);
          }}
        />
      )}
    </th>
  );

  if (employees.length === 0) {
    return <p className={emptyStateCompact}>{t("admin.employeesEmpty")}</p>;
  }

  const showSelect = Boolean(onToggleSelect && selectedIds);
  const showLoginStatus = employees.some((e) => e.loginEligible !== undefined);
  const tableMinWidth =
    (showSelect ? SELECT_COL_WIDTH : 0) +
    widths.name +
    widths.email +
    widths.password +
    widths.role +
    widths.department +
    (showLoginStatus ? LOGIN_COL_WIDTH : 0) +
    SCHEDULE_COL_WIDTH +
    widths.actions;
  const allSelected =
    showSelect && employees.length > 0 && employees.every((e) => selectedIds!.has(e.id));

  return (
    <div className={tableWrap}>
      <table
        className={empTable}
        style={{ tableLayout: "fixed", width: "100%", minWidth: tableMinWidth }}
      >
        <colgroup>
          {showSelect && <col style={{ width: SELECT_COL_WIDTH }} />}
          <col style={{ width: widths.name }} />
          <col style={{ width: widths.email }} />
          <col style={{ width: widths.password }} />
          <col style={{ width: widths.role }} />
          <col style={{ width: widths.department }} />
          {showLoginStatus && (
            <col style={{ width: LOGIN_COL_WIDTH, minWidth: LOGIN_COL_WIDTH }} />
          )}
          <col style={{ width: SCHEDULE_COL_WIDTH, minWidth: SCHEDULE_COL_WIDTH }} />
          <col style={{ width: widths.actions, minWidth: MIN_WIDTHS.actions }} />
        </colgroup>
        <thead className={tableHead}>
          <tr>
            {showSelect && (
              <th className={`${empTh} text-center`} style={{ width: SELECT_COL_WIDTH }}>
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="w-4 shrink-0 text-center text-[0.6875rem] font-medium text-[var(--apple-label-tertiary)]"
                    aria-hidden
                  >
                    #
                  </span>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => onToggleSelectAll?.()}
                    aria-label={t("admin.empScheduleSelectAll")}
                  />
                </div>
              </th>
            )}
            {headerCell("name", t("admin.employeesNameLabel"), true)}
            {headerCell("email", t("admin.employeesEmailLabel"), true)}
            {headerCell("password", t("admin.employeesPasswordColLabel"), true)}
            {headerCell("role", t("admin.employeesRoleLabel"), true)}
            {headerCell("department", t("admin.employeesDepartmentLabel"), true)}
            {showLoginStatus && (
              <th
                className={`${empTh} text-center`}
                style={{ width: LOGIN_COL_WIDTH, minWidth: LOGIN_COL_WIDTH }}
              >
                {t("admin.employeesLoginStatusCol")}
              </th>
            )}
            <th
              className={`${empTh} text-left`}
              style={{ width: SCHEDULE_COL_WIDTH, minWidth: SCHEDULE_COL_WIDTH }}
            >
              {t("admin.empScheduleCol")}
            </th>
            <th
              className={`${empTh} text-center`}
              style={{ width: widths.actions, minWidth: MIN_WIDTHS.actions }}
            >
              {t("admin.employeesColActions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedEmployees.map((e, rowIndex) => {
            const isSelf = callerUserId != null && e.user.id === callerUserId;
            const canEditThisRole =
              canEditRoles &&
              !isSelf &&
              assignableRoles.some((r) => canAssignRole(callerRole, e.user.role, r));
            const isBusy = rowBusyId === e.id;
            const canDeleteThis =
              canEditProfile && canDeleteEmployee(callerRole, e.user.role, isSelf);
            const deleteTitle = deleteDisabledReason(e, isSelf);
            const editingPassword = passwordEditId === e.id;

            return (
              <tr key={e.id} className={trDivider}>
                {showSelect && (
                  <td className={`${empTd} text-center`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span
                        className="w-4 shrink-0 text-right tabular-nums text-[0.6875rem] text-[var(--apple-label-tertiary)]"
                        aria-hidden
                      >
                        {rowIndex + 1}
                      </span>
                      <input
                        type="checkbox"
                        checked={selectedIds!.has(e.id)}
                        onChange={() => onToggleSelect?.(e.id)}
                        disabled={isBusy}
                        aria-label={t("admin.empScheduleSelectRow").replace("{name}", e.name)}
                      />
                    </div>
                  </td>
                )}
                <td className={empTd}>
                  {canEditProfile ? (
                    <input
                      className={`${rowInput} font-medium`}
                      defaultValue={e.name}
                      key={`name-${e.id}-${e.name}`}
                      disabled={isBusy}
                      aria-label={t("admin.employeesNameLabel")}
                      onBlur={(ev) => onSaveName(e, ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") ev.currentTarget.blur();
                      }}
                    />
                  ) : (
                    <p className={`${rowControlStatic} truncate font-medium`}>{e.name}</p>
                  )}
                </td>
                <td className={empTd}>
                  {canEditProfile ? (
                    <input
                      type="email"
                      autoComplete="off"
                      className={rowInput}
                      defaultValue={e.user.email}
                      key={`email-${e.id}-${e.user.email}`}
                      disabled={isBusy}
                      aria-label={t("admin.employeesEmailLabel")}
                      onBlur={(ev) => onSaveEmail(e, ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") ev.currentTarget.blur();
                      }}
                    />
                  ) : (
                    <p className={`${rowControlStatic} truncate`}>{e.user.email}</p>
                  )}
                </td>
                <td className={empTd}>
                  {canEditProfile ? (
                    editingPassword ? (
                      <input
                        type="password"
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        autoFocus
                        className={rowInput}
                        placeholder="····"
                        value={passwordDraft}
                        disabled={isBusy}
                        aria-label={t("admin.employeesPasswordLabel")}
                        onChange={(ev) => onPasswordDraftChange(ev.target.value)}
                        onBlur={() => onPasswordEditFinish(e.id)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") {
                            ev.preventDefault();
                            onPasswordEditFinish(e.id);
                          }
                          if (ev.key === "Escape") onPasswordEditCancel();
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${rowPasswordMask} w-full cursor-pointer`}
                        disabled={isBusy}
                        title={t("admin.employeesPasswordReset")}
                        aria-label={t("admin.employeesPasswordReset")}
                        onClick={() => onPasswordEditStart(e.id)}
                      >
                        ********
                      </button>
                    )
                  ) : (
                    <span className={rowPasswordMask} aria-hidden>
                      ********
                    </span>
                  )}
                </td>
                <td className={empTd}>
                  {canEditThisRole ? (
                    <select
                      className={`auth-select-field ${rowControl}`}
                      value={e.user.role}
                      disabled={isBusy}
                      aria-label={t("admin.employeesRoleLabel")}
                      onChange={(ev) => onChangeRole(e, ev.target.value as Role)}
                    >
                      {[
                        e.user.role as Role,
                        ...assignableRoles.filter((r) => r !== e.user.role),
                      ].map((r) => (
                        <option
                          key={r}
                          value={r}
                          disabled={
                            !canAssignRole(callerRole, e.user.role, r) && r !== e.user.role
                          }
                        >
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`${rowControlStatic} truncate`}>{roleLabel(e.user.role)}</span>
                  )}
                </td>
                <td className={empTd}>
                  <select
                    className={`auth-select-field ${rowControl}`}
                    value={e.department?.id ?? ""}
                    disabled={isBusy || !canEditProfile}
                    aria-label={t("admin.employeesDepartmentLabel")}
                    onChange={(ev) => onChangeDepartment(e.id, ev.target.value)}
                  >
                    <option value="">{t("admin.employeesDepartmentNone")}</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </td>
                {showLoginStatus && (
                  <td className={`${empTd} text-center`}>
                    {e.loginEligible ? (
                      <span
                        className="inline-flex whitespace-nowrap rounded-md bg-[var(--apple-green)]/12 px-2 py-0.5 text-[0.75rem] font-medium leading-none text-[var(--apple-green-dark)]"
                        title={
                          e.loginEligibleByAdmin
                            ? e.user.role === "DOOR"
                              ? t("admin.employeesLoginEligibleDoor")
                              : t("admin.employeesLoginEligibleAdmin")
                            : e.seatRank != null
                              ? `#${e.seatRank}`
                              : undefined
                        }
                      >
                        {e.loginEligibleByAdmin
                          ? e.user.role === "DOOR"
                            ? t("admin.employeesLoginEligibleDoor")
                            : t("admin.employeesLoginEligibleAdmin")
                          : t("admin.employeesLoginEligible")}
                      </span>
                    ) : (
                      <span className="inline-flex whitespace-nowrap rounded-md bg-[var(--apple-red)]/10 px-2 py-0.5 text-[0.75rem] font-medium leading-none text-[var(--apple-red)]">
                        {t("admin.employeesLoginIneligible")}
                      </span>
                    )}
                  </td>
                )}
                <td className={empTd}>
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate text-[0.75rem] text-[var(--apple-label-secondary)]">
                      {e.scheduleSummary ?? "—"}
                    </span>
                    {canEditSchedule && onEditSchedule && (
                      <button
                        type="button"
                        className="shrink-0 text-[0.75rem] font-medium text-[var(--apple-blue)] hover:underline"
                        disabled={isBusy}
                        onClick={() => onEditSchedule(e)}
                      >
                        {t("admin.empScheduleEdit")}
                      </button>
                    )}
                  </div>
                </td>
                <td className={`${empTd} text-center`}>
                  {canEditProfile ? (
                    <button
                      type="button"
                      className={`${empBtnDanger} whitespace-nowrap`}
                      disabled={!canDeleteThis || isBusy}
                      title={deleteTitle}
                      onClick={() => {
                        if (canDeleteThis) onDelete(e);
                      }}
                    >
                      {t("admin.employeesDelete")}
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
