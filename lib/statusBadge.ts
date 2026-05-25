/** Apple-style status chips */
const base =
  "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold leading-none sm:text-[0.8125rem]";

const baseLg =
  "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[0.8125rem] font-semibold leading-none sm:text-[0.875rem]";

export function statusBadge(status: string, lg = false): string {
  const b = lg ? baseLg : base;
  switch (status) {
    case "APPROVED":
      return `${b} bg-[var(--apple-green)]/14 text-[var(--apple-green-dark)]`;
    case "PENDING":
      return `${b} bg-[var(--apple-orange)]/14 text-[var(--apple-orange-dark)]`;
    case "MIXED":
      return `${b} bg-[var(--fill-secondary)] text-[var(--apple-label-secondary)]`;
    case "REJECTED":
      return `${b} bg-[var(--apple-red)]/12 text-[var(--apple-red)]`;
    default:
      return `${b} bg-[var(--fill-secondary)] text-[var(--apple-label-secondary)]`;
  }
}

export function roleBadge(role: string, lg = false): string {
  const b = lg ? baseLg : base;
  switch (role) {
    case "COMPANY_ADMIN":
      return `${b} bg-[var(--apple-blue)]/12 text-[var(--apple-blue)]`;
    case "HR_MANAGER":
      return `${b} bg-[var(--apple-orange)]/12 text-[var(--apple-orange-dark)]`;
    case "APPROVER":
      return `${b} bg-[var(--apple-green)]/14 text-[var(--apple-green-dark)]`;
    case "EMPLOYEE":
      return `${b} bg-[var(--fill-secondary)] text-[var(--apple-label-secondary)]`;
    default:
      return `${b} bg-[var(--fill-secondary)] text-[var(--apple-label-secondary)]`;
  }
}

export const metaCaption = "block text-[0.75rem] leading-snug text-[var(--apple-label-tertiary)] sm:text-[0.8125rem]";
