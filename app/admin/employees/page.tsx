"use client";

import {
  DepartmentManagerModal,
  type Department,
} from "@/components/admin/DepartmentManagerModal";
import { EmployeeListTable } from "@/components/admin/EmployeeListTable";
import { useI18n } from "@/components/LanguageProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  bannerWarning,
  btnPrimary,
  btnSecondary,
  card,
  cardBody,
  errorText,
  input,
  label,
  link,
  pageStack,
  sectionLabel,
  select,
} from "@/lib/uiStyles";
import {
  assignableRolesForCaller,
  canAssignRole,
  canDeleteEmployee,
} from "@/lib/roleHierarchy";
import type { Role } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Emp = {
  id: string;
  name: string;
  user: { id: string; email: string; role: string };
  department: { id: string; name: string } | null;
};

const profileEditRoles = new Set<Role>(["COMPANY_ADMIN", "HR_MANAGER", "SUPER_ADMIN"]);

export default function AdminEmployeesPage() {
  const { t } = useI18n();
  const { data: sessionData } = useSession();
  const callerRole = (sessionData?.user?.role ?? null) as Role | null;
  const callerUserId = sessionData?.user?.id ?? null;

  const [employees, setEmployees] = useState<Emp[]>([]);
  const [seatInfo, setSeatInfo] = useState<{ used: number; limit: number } | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [newRole, setNewRole] = useState<Role>("EMPLOYEE");
  const [error, setError] = useState<string | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [passwordEditId, setPasswordEditId] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");

  const assignableRoles = useMemo(
    () => assignableRolesForCaller(callerRole),
    [callerRole]
  );

  const loadEmployees = useCallback(async () => {
    try {
      const [er, br] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/admin/billing"),
      ]);
      const ej = await er.json().catch(() => ({}));
      const bj = await br.json().catch(() => ({}));
      if (er.ok) {
        setEmployees(Array.isArray(ej.employees) ? ej.employees : []);
        setError(null);
      } else if (typeof ej?.error === "string") {
        setError(ej.error);
      }
      if (br.ok) {
        setSeatInfo({ used: bj.employeeCount ?? 0, limit: bj.company?.seatLimit ?? 0 });
      }
    } catch (e) {
      console.error("[employees load]", e);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/departments");
      if (!r.ok) return;
      const j = await r.json().catch(() => ({}));
      setDepartments(Array.isArray(j.departments) ? j.departments : []);
    } catch (e) {
      console.error("[departments load]", e);
    }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadEmployees(), loadDepartments()]);
  }, [loadEmployees, loadDepartments]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function roleLabel(r: string) {
    switch (r) {
      case "COMPANY_ADMIN":
        return t("common.roleCompanyAdmin");
      case "HR_MANAGER":
        return t("common.roleHrManager");
      case "APPROVER":
        return t("common.roleApprover");
      case "EMPLOYEE":
        return t("common.roleEmployee");
      default:
        return r;
    }
  }

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!departmentId) {
      setError(t("admin.employeesDepartmentRequired"));
      return;
    }
    const r = await fetch("/api/admin/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        name,
        password,
        departmentId,
        role: newRole,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(typeof j.error === "string" ? j.error : t("admin.employeesAddFail"));
      return;
    }
    setEmail("");
    setName("");
    setPassword("");
    setDepartmentId("");
    setNewRole("EMPLOYEE");
    await loadAll();
  }

  const canEditProfile = callerRole != null && profileEditRoles.has(callerRole);

  async function patchEmployee(
    empId: string,
    body: Record<string, unknown>,
    opts?: {
      optimistic?: (prev: Emp[]) => Emp[];
      revert?: () => void;
    }
  ): Promise<boolean> {
    setRowBusyId(empId);
    setRowError(null);
    if (opts?.optimistic) setEmployees(opts.optimistic);
    try {
      const r = await fetch(`/api/admin/employees/${encodeURIComponent(empId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          j.error === "EMAIL_TAKEN"
            ? t("admin.employeesEmailTaken")
            : typeof j.message === "string"
              ? j.message
              : typeof j.error === "string"
                ? j.error
                : t("admin.employeesProfileSaveFail");
        setRowError(msg);
        opts?.revert?.();
        return false;
      }
      const updated = j.employee as Emp | undefined;
      if (updated) {
        setEmployees((prev) => prev.map((x) => (x.id === empId ? updated : x)));
      } else {
        await loadEmployees();
      }
      return true;
    } catch (err) {
      console.error("[employees patch]", err);
      setRowError(t("admin.employeesProfileSaveFail"));
      opts?.revert?.();
      return false;
    } finally {
      setRowBusyId(null);
    }
  }

  async function saveName(emp: Emp, raw: string) {
    const next = raw.trim();
    if (!next || next === emp.name) return;
    const prev = emp.name;
    await patchEmployee(
      emp.id,
      { name: next },
      {
        optimistic: (list) =>
          list.map((x) => (x.id === emp.id ? { ...x, name: next } : x)),
        revert: () =>
          setEmployees((list) =>
            list.map((x) => (x.id === emp.id ? { ...x, name: prev } : x))
          ),
      }
    );
  }

  async function saveEmail(emp: Emp, raw: string) {
    const next = raw.trim().toLowerCase();
    if (!next || next === emp.user.email.toLowerCase()) return;
    const prev = emp.user.email;
    await patchEmployee(
      emp.id,
      { email: next },
      {
        optimistic: (list) =>
          list.map((x) =>
            x.id === emp.id ? { ...x, user: { ...x.user, email: next } } : x
          ),
        revert: () =>
          setEmployees((list) =>
            list.map((x) =>
              x.id === emp.id ? { ...x, user: { ...x.user, email: prev } } : x
            )
          ),
      }
    );
  }

  async function savePassword(empId: string): Promise<boolean> {
    const pwd = passwordDraft.trim();
    if (pwd.length < 8) {
      setRowError(t("admin.employeesPasswordHint"));
      return false;
    }
    const ok = await patchEmployee(empId, { password: pwd });
    if (ok) {
      setPasswordEditId(null);
      setPasswordDraft("");
    }
    return ok;
  }

  async function finishPasswordEdit(empId: string) {
    if (passwordEditId !== empId) return;
    const pwd = passwordDraft.trim();
    if (pwd.length === 0) {
      setPasswordEditId(null);
      setPasswordDraft("");
      return;
    }
    if (pwd.length < 8) {
      setRowError(t("admin.employeesPasswordHint"));
      return;
    }
    await savePassword(empId);
  }

  function deleteDisabledReason(emp: Emp, isSelf: boolean): string | undefined {
    if (isSelf) return t("admin.employeesCannotDeleteSelf");
    if (!canDeleteEmployee(callerRole, emp.user.role, isSelf)) {
      return t("admin.employeesDeleteNotAllowed");
    }
    return undefined;
  }

  async function deleteEmployee(emp: Emp) {
    const ok = window.confirm(
      t("admin.employeesDeleteConfirm").replace("{name}", emp.name)
    );
    if (!ok) return;
    setRowBusyId(emp.id);
    setRowError(null);
    if (passwordEditId === emp.id) {
      setPasswordEditId(null);
      setPasswordDraft("");
    }
    try {
      const r = await fetch(`/api/admin/employees/${encodeURIComponent(emp.id)}`, {
        method: "DELETE",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          j.error === "CANNOT_DELETE_SELF"
            ? t("admin.employeesCannotDeleteSelf")
            : j.error === "LAST_ADMIN"
              ? t("admin.employeesLastAdmin")
              : j.error === "ROLE_NOT_ALLOWED"
                ? t("admin.employeesDeleteNotAllowed")
                : typeof j.message === "string"
                  ? j.message
                  : t("admin.employeesDeleteFail");
        setRowError(msg);
        return;
      }
      setEmployees((prev) => prev.filter((x) => x.id !== emp.id));
      await loadEmployees();
    } catch (err) {
      console.error("[employees delete]", err);
      setRowError(t("admin.employeesDeleteFail"));
    } finally {
      setRowBusyId(null);
    }
  }

  async function changeDepartment(empId: string, nextDeptId: string) {
    setRowBusyId(empId);
    setRowError(null);
    try {
      const r = await fetch(`/api/admin/employees/${encodeURIComponent(empId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: nextDeptId || null }),
      });
      if (!r.ok) {
        await loadEmployees();
        return;
      }
      const j = await r.json().catch(() => ({}));
      const updated = j.employee as Emp | undefined;
      if (updated) {
        setEmployees((prev) =>
          prev.map((x) => (x.id === empId ? { ...x, department: updated.department } : x))
        );
      } else {
        await loadEmployees();
      }
    } catch (err) {
      console.error("[employees patch]", err);
      await loadEmployees();
    } finally {
      setRowBusyId(null);
    }
  }

  async function changeRole(emp: Emp, nextRole: Role) {
    if (nextRole === emp.user.role) return;
    setRowBusyId(emp.id);
    setRowError(null);
    const prevRole = emp.user.role;
    setEmployees((prev) =>
      prev.map((x) => (x.id === emp.id ? { ...x, user: { ...x.user, role: nextRole } } : x))
    );
    try {
      const r = await fetch(`/api/admin/employees/${encodeURIComponent(emp.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setRowError(
          typeof j.message === "string"
            ? j.message
            : typeof j.error === "string"
              ? j.error
              : t("admin.employeesRoleSaveFail")
        );
        setEmployees((prev) =>
          prev.map((x) => (x.id === emp.id ? { ...x, user: { ...x.user, role: prevRole } } : x))
        );
        return;
      }
      const updated = j.employee as Emp | undefined;
      if (updated?.user?.role) {
        setEmployees((prev) =>
          prev.map((x) =>
            x.id === emp.id ? { ...x, user: { ...x.user, role: updated.user.role } } : x
          )
        );
      }
    } catch (err) {
      console.error("[employees role patch]", err);
      setEmployees((prev) =>
        prev.map((x) => (x.id === emp.id ? { ...x, user: { ...x.user, role: prevRole } } : x))
      );
    } finally {
      setRowBusyId(null);
    }
  }

  const seatLine = seatInfo
    ? t("admin.employeesSeatLine")
        .replace("{used}", String(seatInfo.used))
        .replace("{limit}", String(seatInfo.limit))
    : undefined;

  const noDepartments = departments.length === 0;
  const canEditRoles = assignableRoles.length > 0;

  return (
    <div className={pageStack}>
      <PageHeader
        title={t("admin.employeesTitle")}
        subtitle={seatLine}
        actions={
          seatInfo ? (
            <a href="/admin/billing" className={link}>
              {t("admin.employeesUpgradeLink")}
            </a>
          ) : undefined
        }
      />

      <section>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className={`${sectionLabel} mb-0`}>{t("admin.employeesAddTitle")}</p>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setDeptModalOpen(true)}
          >
            {t("admin.employeesDepartmentManage")}
          </button>
        </div>
        <div className={card}>
          <div className={cardBody}>
            {noDepartments && (
              <p className={`${bannerWarning} mb-4`}>{t("admin.employeesNoDepartmentsYet")}</p>
            )}
            <form onSubmit={(e) => void addEmployee(e)} className="grid max-w-xl gap-x-4 gap-y-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>
                  {t("admin.employeesEmailLabel")}{" "}
                  <span aria-hidden className="text-[var(--apple-red)]">*</span>
                </label>
                <input
                  required
                  type="email"
                  className={`${input} mt-1.5`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>
                  {t("admin.employeesNameLabel")}{" "}
                  <span aria-hidden className="text-[var(--apple-red)]">*</span>
                </label>
                <input
                  required
                  className={`${input} mt-1.5`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className={label}>
                  {t("admin.employeesPasswordLabel")}{" "}
                  <span aria-hidden className="text-[var(--apple-red)]">*</span>
                </label>
                <input
                  required
                  type="password"
                  minLength={8}
                  className={`${input} mt-1.5`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("admin.employeesPasswordHint")}
                />
              </div>
              <div>
                <label className={label}>
                  {t("admin.employeesDepartmentLabel")}{" "}
                  <span aria-hidden className="text-[var(--apple-red)]">*</span>
                </label>
                <select
                  required
                  className={`${select} mt-1.5`}
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  disabled={noDepartments}
                >
                  <option value="" disabled>
                    {t("admin.employeesDepartmentSelect")}
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              {canEditRoles ? (
                <div>
                  <label className={label}>{t("admin.employeesRoleLabel")}</label>
                  <select
                    className={`${select} mt-1.5`}
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="hidden sm:block" aria-hidden />
              )}
              {error && <p className={`${errorText} sm:col-span-2`}>{error}</p>}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className={`${btnPrimary} w-full sm:w-auto`}
                  disabled={noDepartments}
                >
                  {t("admin.employeesAddButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section>
        <p className={sectionLabel}>{t("admin.employeesListTitle")}</p>
        {rowError && <p className={`mb-3 ${errorText}`}>{rowError}</p>}
        <EmployeeListTable
            employees={employees}
            departments={departments}
            canEditProfile={canEditProfile}
            canEditRoles={canEditRoles}
            callerRole={callerRole}
            callerUserId={callerUserId}
            assignableRoles={assignableRoles}
            rowBusyId={rowBusyId}
            passwordEditId={passwordEditId}
            passwordDraft={passwordDraft}
            onPasswordDraftChange={setPasswordDraft}
            onPasswordEditStart={(empId) => {
              setPasswordEditId(empId);
              setPasswordDraft("");
              setRowError(null);
            }}
            onPasswordEditFinish={(empId) => void finishPasswordEdit(empId)}
            onPasswordEditCancel={() => {
              setPasswordEditId(null);
              setPasswordDraft("");
            }}
            onSaveName={(emp, value) => void saveName(emp, value)}
            onSaveEmail={(emp, value) => void saveEmail(emp, value)}
            onChangeRole={(emp, role) => void changeRole(emp, role)}
            onChangeDepartment={(empId, deptId) => void changeDepartment(empId, deptId)}
            onDelete={(emp) => void deleteEmployee(emp)}
            deleteDisabledReason={deleteDisabledReason}
            roleLabel={roleLabel}
          />
      </section>

      <DepartmentManagerModal
        open={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        onChanged={() => void loadAll()}
      />
    </div>
  );
}
